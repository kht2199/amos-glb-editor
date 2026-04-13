import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { DEFAULT_ANIMATION } from './constants'
import { createPortNode } from './portVisual'
import type { DomainParentType, Face, LiftEntity, PortEntity, PortSemanticRole, PortType, BackgroundObjectEntity, SceneBundle, Vec3 } from '../types'
import { computePortPosition, inferFaceAndSlot, round } from './utils'

type DetectableObjectType = 'Lift' | 'Port' | 'Bridge' | 'Rail' | 'Stocker' | 'Transport'

interface InferredPortNameMeta {
  semanticRole?: PortSemanticRole
  portType?: PortType
  face?: Face
  slot?: number
  domainParentType?: DomainParentType
  parentKey?: string
}

function normalizeName(object: THREE.Object3D) {
  const parts = [object.name, object.parent?.name]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
  return parts.join(' ')
}

function detectObjectType(object: THREE.Object3D): DetectableObjectType | null {
  const explicit = object.userData?.editorMeta?.objectType
  if (explicit === 'Lift' || explicit === 'Port' || explicit === 'Bridge' || explicit === 'Rail' || explicit === 'Stocker' || explicit === 'Transport') {
    return explicit
  }

  const normalized = normalizeName(object)
  if (normalized.includes('transport') || normalized.includes('oht') || normalized.includes('vehicle') || normalized.includes('carrier') || normalized.includes('shuttle')) return 'Transport'
  if (normalized.includes('loadport') || normalized.includes('load_port')) return 'Port'
  if (normalized.includes('port')) return 'Port'
  if (normalized.includes('access') || normalized.includes('handoff') || normalized.includes('dock')) return 'Port'
  if (normalized.includes('lift') || normalized.includes('elevator') || normalized.includes('hoist')) return 'Lift'
  if (normalized.includes('bridge')) return 'Bridge'
  if (normalized.includes('rail') || normalized.includes('track')) return 'Rail'
  if (normalized.includes('stocker') || normalized.includes('storage') || normalized.includes('cabinet') || normalized.includes('shelf')) return 'Stocker'
  return null
}

function hasTypedAncestor(object: THREE.Object3D) {
  const selfKind = detectObjectType(object)
  let current = object.parent
  while (current) {
    const ancestorKind = detectObjectType(current)
    if (ancestorKind) {
      if (selfKind === 'Port' && ancestorKind !== 'Port') return false
      return true
    }
    current = current.parent
  }
  return false
}

function computeBounds(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)
  return { size, center }
}

function editorMeta(object: THREE.Object3D) {
  const raw = object.userData?.editorMeta ?? {}
  return {
    id: String(raw.id || object.name || object.uuid),
    objectType: raw.objectType,
    entityId: String(raw.entityId || raw.id || object.name || object.uuid),
    domainParentId: raw.domainParentId ? String(raw.domainParentId) : undefined,
    domainParentType: raw.domainParentType as DomainParentType | undefined,
    parentLiftId: raw.parentLiftId ? String(raw.parentLiftId) : undefined,
    semanticRole: raw.semanticRole as PortSemanticRole | undefined,
    slotsPerFace: typeof raw.slotsPerFace === 'number' ? raw.slotsPerFace : undefined,
    animation: raw.animation,
    portType: raw.portType as PortType | undefined,
    face: raw.face,
    slot: typeof raw.slot === 'number' ? raw.slot : undefined,
    zOffset: typeof raw.zOffset === 'number' ? raw.zOffset : undefined,
  }
}

function asRotation(object: THREE.Object3D): 0 | 90 | 180 | 270 {
  const degrees = ((THREE.MathUtils.radToDeg(object.rotation.z) % 360) + 360) % 360
  const snapped = Math.round(degrees / 90) * 90
  return ([0, 90, 180, 270].includes(snapped) ? snapped : 0) as 0 | 90 | 180 | 270
}

function asPortType(name: string): PortType {
  const normalized = name.toLowerCase()
  if (normalized.includes('inout')) return 'INOUT'
  if (normalized.includes('out')) return 'OUT'
  return 'IN'
}

function inferSlotsPerFace(size: THREE.Vector3) {
  const dominantFaceSpan = Math.max(size.x, size.y)
  const approximate = Math.max(2, Math.round(dominantFaceSpan / 10))
  return Math.min(approximate, 12)
}

function inferPortNameMeta(name: string): InferredPortNameMeta {
  const normalized = name.toLowerCase()
  const meta: InferredPortNameMeta = {}

  if (normalized.includes('stocker') || normalized.includes('shelf')) {
    meta.semanticRole = 'STOCKER_ACCESS'
    meta.domainParentType = 'Stocker'
  } else if (normalized.includes('buffer') || normalized.includes('handoff')) {
    meta.semanticRole = 'BUFFER_HANDOFF'
    meta.domainParentType = 'Transport'
  } else if (normalized.includes('tool')) {
    meta.semanticRole = 'TOOL_LOAD'
  }

  if (normalized.includes('inout')) meta.portType = 'INOUT'
  else if (/(^|[_\s-])out([_\s-]|$)/.test(normalized)) meta.portType = 'OUT'
  else if (/(^|[_\s-])in([_\s-]|$)/.test(normalized)) meta.portType = 'IN'

  if (normalized.includes('front')) meta.face = 'FRONT'
  else if (normalized.includes('back') || normalized.includes('rear')) meta.face = 'BACK'
  else if (normalized.includes('left')) meta.face = 'LEFT'
  else if (normalized.includes('right')) meta.face = 'RIGHT'

  const slotMatch = normalized.match(/(?:slot|port|dock|access|lp)[_\s-]?0*(\d{1,2})(?:[_\s-]|$)/)
    ?? normalized.match(/(?:_|\b)0*(\d{1,2})(?:[_\s-]|\b|$)/)
  if (slotMatch) meta.slot = Number(slotMatch[1])

  const parentKeyMatch = normalized.match(/(lift[_\s-]*[a-z0-9]+)/)
  if (parentKeyMatch) meta.parentKey = parentKeyMatch[1].replace(/[_\s-]+/g, '')

  return meta
}

function normalizedEntityKey(value?: string) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function makeLiftEntity(object: THREE.Object3D): LiftEntity {
  const { size, center } = computeBounds(object)
  const meta = editorMeta(object)
  const slotsPerFace = meta.slotsPerFace ?? inferSlotsPerFace(size)
  const animation = meta.animation && typeof meta.animation === 'object'
    ? { ...DEFAULT_ANIMATION, ...(meta.animation as Partial<LiftEntity['animation']>) }
    : { ...DEFAULT_ANIMATION, maxZ: round(size.z) }

  object.userData.editorMeta = {
    ...(object.userData.editorMeta ?? {}),
    id: meta.id,
    entityId: meta.entityId,
    objectType: 'Lift',
    slotsPerFace,
    animation,
  }

  return {
    id: meta.entityId,
    editorId: meta.id,
    label: object.name || meta.entityId,
    objectType: 'Lift',
    nodeName: object.name || meta.entityId,
    position: { x: round(center.x), y: round(center.y), z: round(center.z - size.z / 2) },
    width: Math.max(round(size.x), 20),
    depth: Math.max(round(size.y), 20),
    height: Math.max(round(size.z), 10),
    rotation: asRotation(object),
    slotsPerFace,
    animation,
  }
}

function makeBackgroundObjectEntity(object: THREE.Object3D, objectType: 'Bridge' | 'Rail' | 'Stocker' | 'Transport'): BackgroundObjectEntity {
  const { size, center } = computeBounds(object)
  const meta = editorMeta(object)
  object.userData.editorMeta = { ...(object.userData.editorMeta ?? {}), id: meta.id, entityId: meta.entityId, objectType }
  return {
    id: meta.entityId,
    editorId: meta.id,
    label: object.name || meta.entityId,
    objectType,
    nodeName: object.name || meta.entityId,
    position: { x: round(center.x), y: round(center.y), z: round(center.z - size.z / 2) },
    width: Math.max(round(size.x), 10),
    depth: Math.max(round(size.y), 10),
    height: Math.max(round(size.z), 10),
  }
}

function nearestLift(position: Vec3, lifts: LiftEntity[]) {
  return lifts
    .map((lift) => ({ lift, distance: Math.hypot(position.x - lift.position.x, position.y - lift.position.y) }))
    .sort((a, b) => a.distance - b.distance)[0]?.lift
}

function nearestBackgroundObject(position: Vec3, backgroundObjects: BackgroundObjectEntity[], kind: 'Stocker' | 'Transport') {
  return backgroundObjects
    .filter((item) => item.objectType === kind)
    .map((item) => ({ item, distance: Math.hypot(position.x - item.position.x, position.y - item.position.y) }))
    .sort((a, b) => a.distance - b.distance)[0]?.item
}

function matchLiftByNameHint(name: string, lifts: LiftEntity[]) {
  const key = inferPortNameMeta(name).parentKey
  if (!key) return undefined
  return lifts.find((lift) => normalizedEntityKey(lift.id) === key || normalizedEntityKey(lift.nodeName) === key || normalizedEntityKey(lift.editorId) === key)
}

function matchBackgroundObjectByHint(name: string, backgroundObjects: BackgroundObjectEntity[], kind: 'Stocker' | 'Transport') {
  const normalized = normalizedEntityKey(name) ?? ''
  return backgroundObjects.find((item) => {
    if (item.objectType !== kind) return false
    const candidates = [item.id, item.nodeName, item.editorId, item.label]
      .map(normalizedEntityKey)
      .filter((value): value is string => Boolean(value))
    return candidates.some((candidate) => normalized.includes(candidate) || candidate.includes(normalized))
  })
}

function assignExternalPortSlot(base: PortEntity, ports: PortEntity[]) {
  const siblings = ports.filter((port) => !port.deleted
    && port.domainParentType === base.domainParentType
    && port.domainParentId === base.domainParentId
    && port.face === base.face)
  const occupied = new Set(siblings.map((port) => port.slot))
  let slot = base.slot
  while (occupied.has(slot)) slot += 1
  return slot
}

function makePortEntity(object: THREE.Object3D, lifts: LiftEntity[], backgroundObjects: BackgroundObjectEntity[], existingPorts: PortEntity[]): PortEntity | null {
  const { size, center } = computeBounds(object)
  const meta = editorMeta(object)
  const inferredNameMeta = inferPortNameMeta(object.name)
  const explicitLift = meta.parentLiftId ? lifts.find((lift) => lift.editorId === meta.parentLiftId) : undefined
  const hintedLift = matchLiftByNameHint(object.name, lifts)
  const parentLift = explicitLift ?? hintedLift ?? nearestLift({ x: center.x, y: center.y, z: center.z }, lifts)

  let domainParentType: DomainParentType = meta.domainParentType ?? inferredNameMeta.domainParentType ?? 'Lift'
  let domainParentId = meta.domainParentId ?? parentLift?.editorId ?? ''
  const semanticRole: PortSemanticRole = meta.semanticRole ?? inferredNameMeta.semanticRole ?? 'LIFT_DOCK'

  if (domainParentType === 'Stocker' && !meta.domainParentId) {
    const stocker = matchBackgroundObjectByHint(object.name, backgroundObjects, 'Stocker')
      ?? nearestBackgroundObject({ x: center.x, y: center.y, z: center.z }, backgroundObjects, 'Stocker')
    if (stocker) domainParentId = stocker.editorId
  }

  if (domainParentType === 'Transport' && !meta.domainParentId) {
    const transport = matchBackgroundObjectByHint(object.name, backgroundObjects, 'Transport')
      ?? nearestBackgroundObject({ x: center.x, y: center.y, z: center.z }, backgroundObjects, 'Transport')
    if (transport) domainParentId = transport.editorId
  }

  if (semanticRole === 'STOCKER_ACCESS' && !meta.domainParentId) {
    const stocker = nearestBackgroundObject({ x: center.x, y: center.y, z: center.z }, backgroundObjects, 'Stocker')
    if (stocker) {
      domainParentType = 'Stocker'
      domainParentId = stocker.editorId
    }
  }

  if (domainParentType === 'Lift' && !parentLift) return null

  const base: PortEntity = {
    id: meta.entityId,
    editorId: meta.id,
    label: object.name || meta.entityId,
    objectType: 'Port',
    nodeName: object.name || meta.entityId,
    parentLiftId: domainParentType === 'Lift' ? (meta.parentLiftId ?? hintedLift?.editorId ?? parentLift?.editorId) : undefined,
    domainParentId,
    domainParentType,
    semanticRole,
    portType: meta.portType ?? inferredNameMeta.portType ?? asPortType(object.name),
    face: (meta.face === 'FRONT' || meta.face === 'BACK' || meta.face === 'LEFT' || meta.face === 'RIGHT') ? meta.face : (inferredNameMeta.face ?? 'FRONT'),
    slot: meta.slot ?? inferredNameMeta.slot ?? 1,
    position: { x: round(center.x), y: round(center.y), z: round(center.z - size.z / 2) },
    width: Math.max(round(size.x), 6),
    depth: Math.max(round(size.y), 6),
    height: Math.max(round(size.z), 6),
    zOffset: meta.zOffset,
    created: false,
    templateNodeName: object.name,
  }

  if (parentLift && domainParentType === 'Lift') {
    const inferred = inferFaceAndSlot(parentLift, base)
    base.face = meta.face === 'FRONT' || meta.face === 'BACK' || meta.face === 'LEFT' || meta.face === 'RIGHT' ? meta.face : inferred.face
    base.slot = meta.slot ?? inferred.slot
    const baseZ = computePortPosition(parentLift, base.face, base.slot).z
    const inferredZOffset = meta.zOffset ?? round(base.position.z - baseZ)
    base.zOffset = inferredZOffset
    base.position = computePortPosition(parentLift, base.face, base.slot, inferredZOffset)
  } else {
    base.slot = meta.slot ?? inferredNameMeta.slot ?? assignExternalPortSlot(base, existingPorts)
  }

  object.userData.editorMeta = {
    ...(object.userData.editorMeta ?? {}),
    id: meta.id,
    entityId: meta.entityId,
    objectType: 'Port',
    semanticRole: base.semanticRole,
    domainParentId: base.domainParentId,
    domainParentType: base.domainParentType,
    parentLiftId: base.parentLiftId,
    portType: base.portType,
    face: base.face,
    slot: base.slot,
    zOffset: base.zOffset,
  }
  return base
}

export async function loadGlbFile(file: File) {
  const buffer = await file.arrayBuffer()
  const loader = new GLTFLoader()
  const gltf = await loader.parseAsync(buffer, '')
  const pristineScene = gltf.scene.clone(true)
  const scene = gltf.scene
  const lifts: LiftEntity[] = []
  const ports: PortEntity[] = []
  const backgroundObjects: BackgroundObjectEntity[] = []

  scene.traverse((object: THREE.Object3D) => {
    if (object === scene) return
    if (hasTypedAncestor(object)) return
    const kind = detectObjectType(object)
    if (!kind) return
    if (kind === 'Lift') lifts.push(makeLiftEntity(object))
    if (kind === 'Bridge' || kind === 'Rail' || kind === 'Stocker' || kind === 'Transport') backgroundObjects.push(makeBackgroundObjectEntity(object, kind))
  })

  scene.traverse((object: THREE.Object3D) => {
    if (object === scene) return
    if (hasTypedAncestor(object)) return
    if (detectObjectType(object) === 'Port') {
      const port = makePortEntity(object, lifts, backgroundObjects, ports)
      if (port) ports.push(port)
    }
  })

  const bundle: SceneBundle = {
    fileName: file.name,
    lifts,
    ports,
    backgroundObjects,
    originalAnimationsCount: gltf.animations.length,
  }

  return {
    pristineScene,
    animations: gltf.animations,
    bundle,
  }
}

function findByEditorId(root: THREE.Object3D, editorId: string): THREE.Object3D | null {
  let result: THREE.Object3D | null = null
  root.traverse((child: THREE.Object3D) => {
    if (result) return
    if (child.userData?.editorMeta?.id === editorId) result = child
  })
  return result
}

function placeNodeByBottom(node: THREE.Object3D, position: Vec3) {
  node.position.set(position.x, position.y, position.z)
  node.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(node)
  if (Number.isFinite(bounds.min.z)) {
    node.position.z = round(node.position.z + (position.z - bounds.min.z))
  }
}

function createLiftNode(lift: LiftEntity) {
  const group = new THREE.Group()
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(lift.width, lift.depth, lift.height),
    new THREE.MeshStandardMaterial({ color: '#d8dee9', roughness: 0.58, metalness: 0.18 }),
  )
  shell.position.set(0, 0, lift.height / 2)
  group.add(shell)
  group.name = lift.nodeName
  group.rotation.z = (lift.rotation * Math.PI) / 180
  group.userData.editorMeta = {
    id: lift.editorId,
    entityId: lift.id,
    objectType: 'Lift',
    slotsPerFace: lift.slotsPerFace,
    animation: lift.animation,
  }
  placeNodeByBottom(group, lift.position)
  return group
}

function applyLift(scene: THREE.Object3D, lift: LiftEntity) {
  let node: THREE.Object3D | null = findByEditorId(scene, lift.editorId)
  if (!node) {
    node = createLiftNode(lift)
    scene.add(node)
  }
  node.name = lift.nodeName
  placeNodeByBottom(node, lift.position)
  node.rotation.z = (lift.rotation * Math.PI) / 180
  node.userData.editorMeta = {
    ...(node.userData.editorMeta ?? {}),
    id: lift.editorId,
    entityId: lift.id,
    objectType: 'Lift',
    slotsPerFace: lift.slotsPerFace,
    animation: lift.animation,
  }
}

function applyPort(scene: THREE.Object3D, port: PortEntity) {
  let node: THREE.Object3D | null = findByEditorId(scene, port.editorId)
  if (port.deleted) {
    node?.parent?.remove(node)
    return
  }

  if (!node) {
    node = createPortNode(port)
    scene.add(node)
  }

  if (!node) return
  node.visible = true
  node.name = port.nodeName
  placeNodeByBottom(node, port.position)
  node.userData.editorMeta = {
    ...(node.userData.editorMeta ?? {}),
    id: port.editorId,
    entityId: port.id,
    objectType: 'Port',
    portType: port.portType,
    semanticRole: port.semanticRole,
    domainParentId: port.domainParentId,
    domainParentType: port.domainParentType,
    parentLiftId: port.parentLiftId,
    face: port.face,
    slot: port.slot,
    zOffset: port.zOffset,
  }
}

function createBackgroundObjectNode(entity: BackgroundObjectEntity) {
  const group = new THREE.Group()
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(entity.width, entity.depth, entity.height),
    new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.7, metalness: 0.18 }),
  )
  shell.position.set(0, 0, entity.height / 2)
  group.add(shell)
  group.name = entity.nodeName
  group.userData.editorMeta = {
    id: entity.editorId,
    entityId: entity.id,
    objectType: entity.objectType,
  }
  placeNodeByBottom(group, entity.position)
  return group
}

function applyBackgroundObject(scene: THREE.Object3D, entity: BackgroundObjectEntity) {
  let node: THREE.Object3D | null = findByEditorId(scene, entity.editorId)
  if (!node) {
    node = createBackgroundObjectNode(entity)
    scene.add(node)
  }
  node.visible = true
  node.name = entity.nodeName
  placeNodeByBottom(node, entity.position)
  node.userData.editorMeta = {
    ...(node.userData.editorMeta ?? {}),
    id: entity.editorId,
    entityId: entity.id,
    objectType: entity.objectType,
  }
}

export function buildAppliedScene(payload: {
  pristineScene: THREE.Group
  lifts: LiftEntity[]
  ports: PortEntity[]
  backgroundObjects: BackgroundObjectEntity[]
}) {
  const scene = payload.pristineScene.clone(true)
  for (const lift of payload.lifts) applyLift(scene, lift)
  for (const port of payload.ports) applyPort(scene, port)
  for (const backgroundObject of payload.backgroundObjects) applyBackgroundObject(scene, backgroundObject)
  return scene
}

export async function exportGlb(payload: {
  pristineScene: THREE.Group
  lifts: LiftEntity[]
  ports: PortEntity[]
  backgroundObjects: BackgroundObjectEntity[]
  animations: THREE.AnimationClip[]
}) {
  const scene = buildAppliedScene(payload)

  const exporter = new GLTFExporter()
  const arrayBuffer = await exporter.parseAsync(scene, {
    binary: true,
    includeCustomExtensions: true,
    animations: payload.animations,
  })

  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error('GLB export failed: expected binary ArrayBuffer')
  }

  return new Blob([arrayBuffer], { type: 'model/gltf-binary' })
}
