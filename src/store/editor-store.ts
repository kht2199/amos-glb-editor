import { create } from 'zustand'
import * as THREE from 'three'
import { detectCollisions, collisionMap } from '../lib/collision'
import { DEFAULT_ANIMATION } from '../lib/constants'
import { createDemoScene } from '../lib/demoScene'
import { exportGlb, loadGlbFile } from '../lib/glb'
import { computePortPosition, findNearestLift, inferFaceAndSlot, round, snapLiftToNeighbors } from '../lib/utils'
import { validateEntities } from '../lib/validation'
import type {
  CollisionIssue,
  EditorMode,
  EditorSnapshot,
  LiftEntity,
  ObjectKind,
  ObjectTypeCategory,
  ObjectTypeDefinition,
  PortEntity,
  BackgroundObjectEntity,
  TopViewFrame,
  ValidationIssue,
  Vec3,
} from '../types'

interface ExportFeedback {
  status: 'idle' | 'exporting' | 'success' | 'error' | 'blocked'
  message?: string
  downloadUrl?: string
  fileName?: string
}

interface SceneRuntime {
  pristineScene: THREE.Group | null
  animations: THREE.AnimationClip[]
}

const DEFAULT_TOP_VIEW_FRAME: TopViewFrame = {
  originX: 0,
  originY: 0,
  xAxisDirection: 'right',
  yAxisDirection: 'up',
  editPlane: 'xy',
}

export const DEFAULT_OBJECT_TYPE_DEFINITIONS: ObjectTypeDefinition[] = [
  { name: 'Lift', category: 'lift' },
  { name: 'Port', category: 'port' },
  { name: 'Bridge', category: 'background' },
  { name: 'Rail', category: 'background' },
  { name: 'Stocker', category: 'background' },
  { name: 'Transport', category: 'background' },
]

const PROTECTED_OBJECT_TYPES = new Set(['Lift', 'Port'])

function collectSceneObjectTypeDefinitions(bundle: { lifts: LiftEntity[]; ports: PortEntity[]; backgroundObjects: BackgroundObjectEntity[] }) {
  const definitions = new Map<string, ObjectTypeDefinition>()
  const register = (name: string, category: ObjectTypeCategory) => {
    const normalizedName = normalizeTypeName(name)
    if (!normalizedName || definitions.has(normalizedName)) return
    definitions.set(normalizedName, { name: normalizedName, category })
  }

  DEFAULT_OBJECT_TYPE_DEFINITIONS.forEach((definition) => register(definition.name, definition.category))
  bundle.lifts.forEach((item) => register(item.objectType, 'lift'))
  bundle.ports.forEach((item) => register(item.objectType, 'port'))
  bundle.backgroundObjects.forEach((item) => register(item.objectType, 'background'))

  return [...definitions.values()]
}

interface EditorState {
  fileName: string | null
  objectTypeDefinitions: ObjectTypeDefinition[]
  draftLifts: LiftEntity[]
  draftPorts: PortEntity[]
  draftBackgroundObjects: BackgroundObjectEntity[]
  appliedLifts: LiftEntity[]
  appliedPorts: PortEntity[]
  appliedBackgroundObjects: BackgroundObjectEntity[]
  selectedId: string | null
  mode: EditorMode
  topViewFrame: TopViewFrame
  snapEnabled: boolean
  validationIssues: ValidationIssue[]
  collisionIssues: CollisionIssue[]
  collisionIndex: Record<string, CollisionIssue[]>
  isValidationOpen: boolean
  isPreviewOpen: boolean
  statusMessage: string
  exportFeedback: ExportFeedback
  runtime: SceneRuntime
  history: EditorSnapshot[]
  future: EditorSnapshot[]
  canUndo: boolean
  canRedo: boolean
  hasPendingChanges: boolean
  openDemoScene: () => void
  loadFile: (file: File) => Promise<void>
  importFile: (file: File) => Promise<void>
  selectObject: (editorId: string | null) => void
  setMode: (mode: EditorMode) => void
  setTopViewFrame: (frame: Partial<TopViewFrame>) => void
  setSnapEnabled: (enabled: boolean) => void
  setValidationOpen: (open: boolean) => void
  setPreviewOpen: (open: boolean) => void
  addObjectTypeDefinition: (definition: ObjectTypeDefinition) => void
  removeObjectTypeDefinition: (name: string) => void
  moveEntity: (editorId: string, x: number, y: number) => void
  moveLift: (editorId: string, x: number, y: number) => void
  rotateLift: (editorId: string) => void
  updateLift: (editorId: string, patch: Partial<LiftEntity>) => void
  updatePort: (editorId: string, patch: Partial<PortEntity>) => void
  updateBackgroundObject: (editorId: string, patch: Partial<BackgroundObjectEntity>) => void
  setObjectType: (editorId: string, objectType: ObjectKind) => void
  duplicateSelectedObject: () => void
  movePortByWorld: (editorId: string, x: number, y: number) => void
  deletePort: (editorId: string) => void
  applyDraftChanges: () => void
  revertDraftChanges: () => void
  runValidation: () => ValidationIssue[]
  exportCurrentGlb: () => Promise<void>
  closeExportFeedback: () => void
  undo: () => void
  redo: () => void
}

function updateStatus(message = 'Unsaved changes') {
  return {
    statusMessage: message,
  }
}

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    draftLifts: structuredClone(snapshot.draftLifts),
    draftPorts: structuredClone(snapshot.draftPorts),
    draftBackgroundObjects: structuredClone(snapshot.draftBackgroundObjects),
  }
}

function createSnapshot(state: Pick<EditorState, 'draftLifts' | 'draftPorts' | 'draftBackgroundObjects'>): EditorSnapshot {
  return cloneSnapshot({
    draftLifts: state.draftLifts,
    draftPorts: state.draftPorts,
    draftBackgroundObjects: state.draftBackgroundObjects,
  })
}

function hydratePortPositions(lifts: LiftEntity[], ports: PortEntity[]) {
  return ports.map((port) => {
    if (port.domainParentType !== 'Lift' || !port.parentLiftId) return port
    const lift = lifts.find((item) => item.editorId === port.parentLiftId)
    if (!lift || port.deleted) return port
    return {
      ...port,
      position: computePortPosition(lift, port.face, port.slot, port.zOffset ?? (port.position.z - lift.position.z)),
    }
  })
}

function withUpdatedPortPosition(lifts: LiftEntity[], port: PortEntity) {
  if (port.domainParentType !== 'Lift' || !port.parentLiftId) return port
  const lift = lifts.find((item) => item.editorId === port.parentLiftId)
  if (!lift || port.deleted) return port
  const basePosition = computePortPosition(lift, port.face, port.slot)
  const zOffset = port.zOffset ?? (port.position.z - basePosition.z)
  return {
    ...port,
    zOffset,
    position: computePortPosition(lift, port.face, port.slot, zOffset),
  }
}

const DEFAULT_ENTITY_SCALE: Vec3 = { x: 1, y: 1, z: 1 }
const MIN_ENTITY_SCALE = 0.1

type ScalableEntity = LiftEntity | PortEntity | BackgroundObjectEntity

function normalizeScaleValue(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.max(MIN_ENTITY_SCALE, round(value, 4))
}

function inferEntityScale(entity: Pick<ScalableEntity, 'width' | 'depth' | 'height' | 'baseWidth' | 'baseDepth' | 'baseHeight' | 'scale'>): Vec3 {
  if (entity.scale) {
    return {
      x: normalizeScaleValue(entity.scale.x),
      y: normalizeScaleValue(entity.scale.y),
      z: normalizeScaleValue(entity.scale.z),
    }
  }

  return {
    x: normalizeScaleValue(entity.baseWidth ? entity.width / entity.baseWidth : 1),
    y: normalizeScaleValue(entity.baseDepth ? entity.depth / entity.baseDepth : 1),
    z: normalizeScaleValue(entity.baseHeight ? entity.height / entity.baseHeight : 1),
  }
}

function normalizeEntityScale<T extends ScalableEntity>(entity: T): T {
  const scale = inferEntityScale(entity)
  const baseWidth = round(entity.baseWidth ?? (scale.x ? entity.width / scale.x : entity.width))
  const baseDepth = round(entity.baseDepth ?? (scale.y ? entity.depth / scale.y : entity.depth))
  const baseHeight = round(entity.baseHeight ?? (scale.z ? entity.height / scale.z : entity.height))

  return {
    ...entity,
    width: round(baseWidth * scale.x),
    depth: round(baseDepth * scale.y),
    height: round(baseHeight * scale.z),
    baseWidth,
    baseDepth,
    baseHeight,
    scale,
  }
}

function normalizeLiftList(lifts: LiftEntity[]) {
  return lifts.map((lift) => normalizeEntityScale(lift))
}

function normalizePortList(ports: PortEntity[]) {
  return ports.map((port) => normalizeEntityScale(port))
}

function normalizeBackgroundObjectList(backgroundObjects: BackgroundObjectEntity[]) {
  return backgroundObjects.map((entity) => normalizeEntityScale(entity))
}

function moveBackgroundObject(state: EditorState, editorId: string, x: number, y: number) {
  const target = state.draftBackgroundObjects.find((item) => item.editorId === editorId)
  if (!target) return state
  const draftBackgroundObjects = state.draftBackgroundObjects.map((item) => item.editorId === editorId
    ? { ...item, position: { ...item.position, x, y } }
    : item)
  return applyMutation(state, { draftBackgroundObjects, selectedId: editorId }, `${target.objectType} moved`)
}

type SceneEntity = LiftEntity | PortEntity | BackgroundObjectEntity

const DUPLICATE_OFFSET = 20

function normalizeTypeName(name: string) {
  return name.trim()
}

function getObjectTypeCategory(objectTypeDefinitions: ObjectTypeDefinition[], objectType: ObjectKind): ObjectTypeCategory | null {
  const match = objectTypeDefinitions.find((definition) => definition.name === objectType)
  return match?.category ?? null
}

function makeDuplicateId(baseId: string, existingIds: Set<string>) {
  const sanitizedBase = baseId.trim() || 'object'
  let index = 1
  let candidate = `${sanitizedBase}_copy_${String(index).padStart(2, '0')}`
  while (existingIds.has(candidate)) {
    index += 1
    candidate = `${sanitizedBase}_copy_${String(index).padStart(2, '0')}`
  }
  return candidate
}

type SceneBundle = {
  fileName: string
  lifts: LiftEntity[]
  ports: PortEntity[]
  backgroundObjects: BackgroundObjectEntity[]
}

type LoadedSceneFile = Awaited<ReturnType<typeof loadGlbFile>>

type ImportIdentityMaps = {
  idMap: Map<string, string>
  editorIdMap: Map<string, string>
  nodeNameMap: Map<string, string>
}

function makeUniqueValue(baseValue: string, usedValues: Set<string>, fallback = 'object') {
  const normalizedBase = baseValue.trim() || fallback
  let candidate = normalizedBase
  let index = 1
  while (usedValues.has(candidate)) {
    index += 1
    candidate = `${normalizedBase}_${String(index).padStart(2, '0')}`
  }
  usedValues.add(candidate)
  return candidate
}

function remapImportedBundle(existingBundle: SceneBundle, importedBundle: SceneBundle) {
  const usedIds = new Set([...existingBundle.lifts, ...existingBundle.ports, ...existingBundle.backgroundObjects].map((item) => item.id))
  const usedEditorIds = new Set([...existingBundle.lifts, ...existingBundle.ports, ...existingBundle.backgroundObjects].map((item) => item.editorId))
  const usedNodeNames = new Set([...existingBundle.lifts, ...existingBundle.ports, ...existingBundle.backgroundObjects].map((item) => item.nodeName))
  const maps: ImportIdentityMaps = {
    idMap: new Map(),
    editorIdMap: new Map(),
    nodeNameMap: new Map(),
  }

  const registerIdentity = <T extends SceneEntity>(entity: T) => {
    const nextId = makeUniqueValue(entity.id, usedIds, entity.objectType.toLowerCase())
    const nextEditorId = makeUniqueValue(entity.editorId, usedEditorIds, `${entity.objectType.toLowerCase()}_editor`)
    const nextNodeName = makeUniqueValue(entity.nodeName, usedNodeNames, nextId)
    maps.idMap.set(entity.id, nextId)
    maps.editorIdMap.set(entity.editorId, nextEditorId)
    maps.nodeNameMap.set(entity.nodeName, nextNodeName)
    const nextLabel = entity.label === entity.id ? nextId : entity.label === entity.nodeName ? nextNodeName : entity.label
    return {
      ...structuredClone(entity),
      id: nextId,
      editorId: nextEditorId,
      nodeName: nextNodeName,
      label: nextLabel,
    }
  }

  const lifts = importedBundle.lifts.map(registerIdentity)
  const backgroundObjects = importedBundle.backgroundObjects.map(registerIdentity)
  const ports = importedBundle.ports.map((port) => {
    const remappedPort = registerIdentity(port)
    return {
      ...remappedPort,
      parentLiftId: port.parentLiftId ? maps.editorIdMap.get(port.parentLiftId) ?? port.parentLiftId : port.parentLiftId,
      domainParentId: port.domainParentId ? maps.editorIdMap.get(port.domainParentId) ?? port.domainParentId : port.domainParentId,
      attachedToPortId: port.attachedToPortId ? maps.editorIdMap.get(port.attachedToPortId) ?? port.attachedToPortId : port.attachedToPortId,
    }
  })

  return {
    bundle: {
      fileName: importedBundle.fileName,
      lifts,
      ports,
      backgroundObjects,
    },
    maps,
  }
}

function remapImportedPristineScene(scene: THREE.Group | null, maps: ImportIdentityMaps) {
  if (!scene) return null
  const clonedScene = scene.clone(true)
  clonedScene.traverse((object) => {
    if (maps.nodeNameMap.has(object.name)) {
      object.name = maps.nodeNameMap.get(object.name) ?? object.name
    }
    const editorMeta = object.userData?.editorMeta
    if (!editorMeta || typeof editorMeta !== 'object') return
    if (typeof editorMeta.id === 'string') {
      editorMeta.id = maps.editorIdMap.get(editorMeta.id) ?? editorMeta.id
    }
    if (typeof editorMeta.entityId === 'string') {
      editorMeta.entityId = maps.idMap.get(editorMeta.entityId) ?? editorMeta.entityId
    }
    if (typeof editorMeta.domainParentId === 'string') {
      editorMeta.domainParentId = maps.editorIdMap.get(editorMeta.domainParentId) ?? editorMeta.domainParentId
    }
    if (typeof editorMeta.parentLiftId === 'string') {
      editorMeta.parentLiftId = maps.editorIdMap.get(editorMeta.parentLiftId) ?? editorMeta.parentLiftId
    }
    if (typeof editorMeta.attachedToPortId === 'string') {
      editorMeta.attachedToPortId = maps.editorIdMap.get(editorMeta.attachedToPortId) ?? editorMeta.attachedToPortId
    }
  })
  return clonedScene
}

function remapAnimationTrackName(trackName: string, maps: ImportIdentityMaps) {
  const parsedTrack = THREE.PropertyBinding.parseTrackName(trackName)
  const nodeName = parsedTrack.nodeName
  if (!nodeName) return trackName
  const nextNodeName = maps.nodeNameMap.get(nodeName)
  if (!nextNodeName || nextNodeName === nodeName) return trackName
  return `${nextNodeName}${trackName.slice(nodeName.length)}`
}

function remapImportedAnimations(animations: THREE.AnimationClip[], maps: ImportIdentityMaps) {
  return animations.map((clip) => {
    const nextClip = clip.clone()
    nextClip.tracks = nextClip.tracks.map((track) => {
      const nextTrack = track.clone()
      nextTrack.name = remapAnimationTrackName(track.name, maps)
      return nextTrack
    })
    return nextClip
  })
}

function mergePristineScenes(baseScene: THREE.Group | null, importedScene: THREE.Group | null) {
  if (!baseScene) return importedScene?.clone(true) ?? null
  if (!importedScene) return baseScene.clone(true)
  const mergedScene = baseScene.clone(true)
  importedScene.children.forEach((child) => mergedScene.add(child.clone(true)))
  return mergedScene
}

function mergeSceneFileName(currentFileName: string | null, importedFileName: string) {
  if (!currentFileName) return importedFileName
  const nextName = importedFileName.trim()
  if (!nextName || currentFileName.includes(nextName)) return currentFileName
  return `${currentFileName} + ${nextName}`
}

function buildImportedSceneState(state: EditorState, loaded: LoadedSceneFile, importedFileName: string) {
  const baseBundle: SceneBundle = {
    fileName: state.fileName ?? 'scene.glb',
    lifts: state.draftLifts,
    ports: state.draftPorts,
    backgroundObjects: state.draftBackgroundObjects,
  }
  const { bundle: remappedBundle, maps } = remapImportedBundle(baseBundle, loaded.bundle)
  const nextBundle: SceneBundle = {
    fileName: mergeSceneFileName(state.fileName, importedFileName),
    lifts: [...state.draftLifts, ...remappedBundle.lifts],
    ports: [...state.draftPorts, ...remappedBundle.ports],
    backgroundObjects: [...state.draftBackgroundObjects, ...remappedBundle.backgroundObjects],
  }
  const nextRuntime: SceneRuntime = {
    pristineScene: mergePristineScenes(state.runtime.pristineScene, remapImportedPristineScene(loaded.pristineScene, maps)),
    animations: [...state.runtime.animations, ...remapImportedAnimations(loaded.animations, maps)],
  }
  return {
    ...initializeScene(nextBundle, nextRuntime, `${importedFileName} imported`, state.objectTypeDefinitions),
    topViewFrame: { ...state.topViewFrame },
    snapEnabled: state.snapEnabled,
    isPreviewOpen: state.isPreviewOpen,
  }
}

function nextAvailablePortSlot(ports: PortEntity[], port: PortEntity) {
  const occupied = new Set(
    ports
      .filter((item) => !item.deleted
        && item.parentLiftId === port.parentLiftId
        && item.domainParentType === port.domainParentType
        && item.domainParentId === port.domainParentId
        && item.face === port.face)
      .map((item) => item.slot),
  )
  let slot = Math.max(1, port.slot)
  while (occupied.has(slot)) slot += 1
  return slot
}

function duplicateSceneEntity(state: EditorState) {
  const sourceId = state.selectedId
  if (!sourceId) return state

  const sourceLift = state.draftLifts.find((item) => item.editorId === sourceId)
  if (sourceLift) {
    const nextId = makeDuplicateId(sourceLift.id, new Set([...state.draftLifts, ...state.draftPorts, ...state.draftBackgroundObjects].map((item) => item.id)))
    const duplicatedLift: LiftEntity = {
      ...structuredClone(sourceLift),
      id: nextId,
      editorId: crypto.randomUUID(),
      label: nextId,
      nodeName: nextId,
      position: { ...sourceLift.position, x: sourceLift.position.x + DUPLICATE_OFFSET, y: sourceLift.position.y + DUPLICATE_OFFSET },
    }
    return applyMutation(state, {
      draftLifts: [...state.draftLifts, duplicatedLift],
      selectedId: duplicatedLift.editorId,
      mode: 'select',
    }, 'Lift duplicated')
  }

  const sourcePort = state.draftPorts.find((item) => item.editorId === sourceId && !item.deleted)
  if (sourcePort) {
    const nextId = makeDuplicateId(sourcePort.id, new Set([...state.draftLifts, ...state.draftPorts, ...state.draftBackgroundObjects].map((item) => item.id)))
    const duplicatedPortBase: PortEntity = {
      ...structuredClone(sourcePort),
      id: nextId,
      editorId: crypto.randomUUID(),
      label: nextId,
      nodeName: nextId,
      created: true,
      deleted: false,
    }
    const duplicatedPort = sourcePort.parentLiftId
      ? withUpdatedPortPosition(state.draftLifts, {
        ...duplicatedPortBase,
        slot: nextAvailablePortSlot(state.draftPorts, duplicatedPortBase),
      })
      : {
        ...duplicatedPortBase,
        position: { ...sourcePort.position, x: sourcePort.position.x + DUPLICATE_OFFSET, y: sourcePort.position.y + DUPLICATE_OFFSET },
      }

    return applyMutation(state, {
      draftPorts: [...state.draftPorts, duplicatedPort],
      selectedId: duplicatedPort.editorId,
      mode: 'select',
    }, 'Port duplicated')
  }

  const backgroundObject = state.draftBackgroundObjects.find((item) => item.editorId === sourceId)
  if (!backgroundObject) return state
  const nextId = makeDuplicateId(backgroundObject.id, new Set([...state.draftLifts, ...state.draftPorts, ...state.draftBackgroundObjects].map((item) => item.id)))
  const duplicatedBackgroundObject: BackgroundObjectEntity = {
    ...structuredClone(backgroundObject),
    id: nextId,
    editorId: crypto.randomUUID(),
    label: nextId,
    nodeName: nextId,
    position: { ...backgroundObject.position, x: backgroundObject.position.x + DUPLICATE_OFFSET, y: backgroundObject.position.y + DUPLICATE_OFFSET },
  }
  return applyMutation(state, {
    draftBackgroundObjects: [...state.draftBackgroundObjects, duplicatedBackgroundObject],
    selectedId: duplicatedBackgroundObject.editorId,
    mode: 'select',
  }, `${backgroundObject.objectType} duplicated`)
}

function makeLiftFromEntity(entity: SceneEntity): LiftEntity {
  const normalized = normalizeEntityScale(entity)
  const baseAnimation = 'animation' in normalized ? normalized.animation : undefined
  const slotsPerFace = 'slotsPerFace' in normalized ? normalized.slotsPerFace : Math.max(2, Math.round(Math.max(normalized.width, normalized.depth) / 10))

  return {
    id: normalized.id,
    editorId: normalized.editorId,
    label: normalized.label,
    objectType: 'Lift',
    nodeName: normalized.nodeName,
    position: structuredClone(normalized.position),
    width: normalized.width,
    depth: normalized.depth,
    height: normalized.height,
    baseWidth: normalized.baseWidth,
    baseDepth: normalized.baseDepth,
    baseHeight: normalized.baseHeight,
    scale: structuredClone(normalized.scale ?? DEFAULT_ENTITY_SCALE),
    rotation: 'rotation' in normalized ? normalized.rotation : 0,
    slotsPerFace,
    animation: baseAnimation
      ? { ...DEFAULT_ANIMATION, ...baseAnimation }
      : { ...DEFAULT_ANIMATION, enabled: true, minZ: 0, maxZ: Math.max(normalized.height, DEFAULT_ANIMATION.maxZ) },
  }
}

function makeBackgroundObjectFromEntity(entity: SceneEntity, objectType: string): BackgroundObjectEntity {
  const normalized = normalizeEntityScale(entity)
  return {
    id: normalized.id,
    editorId: normalized.editorId,
    label: normalized.label,
    objectType,
    nodeName: normalized.nodeName,
    position: structuredClone(normalized.position),
    width: normalized.width,
    depth: normalized.depth,
    height: normalized.height,
    baseWidth: normalized.baseWidth,
    baseDepth: normalized.baseDepth,
    baseHeight: normalized.baseHeight,
    scale: structuredClone(normalized.scale ?? DEFAULT_ENTITY_SCALE),
    domainLabel: normalized.domainLabel,
  }
}

function makePortFromEntity(entity: SceneEntity, lifts: LiftEntity[]): PortEntity {
  const normalized = normalizeEntityScale(entity)
  const remainingLifts = lifts.filter((lift) => lift.editorId !== normalized.editorId)
  const nearestLift = findNearestLift(remainingLifts, normalized.position.x, normalized.position.y)

  if (nearestLift) {
    const provisional: PortEntity = {
      id: normalized.id,
      editorId: normalized.editorId,
      label: normalized.label,
      objectType: 'Port',
      nodeName: normalized.nodeName,
      parentLiftId: nearestLift.editorId,
      domainParentId: nearestLift.editorId,
      domainParentType: 'Lift',
      semanticRole: 'LIFT_DOCK',
      portType: 'IN',
      face: 'FRONT',
      slot: 1,
      position: structuredClone(normalized.position),
      zOffset: normalized.position.z - nearestLift.position.z,
      width: Math.min(normalized.width, 12),
      depth: Math.min(normalized.depth, 12),
      height: Math.min(normalized.height, 12),
      baseWidth: Math.min(normalized.baseWidth ?? normalized.width, 12),
      baseDepth: Math.min(normalized.baseDepth ?? normalized.depth, 12),
      baseHeight: Math.min(normalized.baseHeight ?? normalized.height, 12),
      scale: structuredClone(normalized.scale ?? DEFAULT_ENTITY_SCALE),
      created: true,
      templateNodeName: 'Port_Template',
      domainLabel: normalized.domainLabel,
    }
    const inferred = inferFaceAndSlot(nearestLift, provisional)
    return withUpdatedPortPosition(remainingLifts.length ? [...remainingLifts, nearestLift] : [nearestLift], {
      ...provisional,
      face: inferred.face,
      slot: inferred.slot,
    })
  }

  const externalParentType = normalized.objectType === 'Stocker'
    ? 'Stocker'
    : normalized.objectType === 'Lift' || normalized.objectType === 'Port'
      ? 'Transport'
      : normalized.objectType
  return {
    id: normalized.id,
    editorId: normalized.editorId,
    label: normalized.label,
    objectType: 'Port',
    nodeName: normalized.nodeName,
    parentLiftId: undefined,
    domainParentId: normalized.editorId,
    domainParentType: externalParentType,
    semanticRole: externalParentType === 'Stocker' ? 'STOCKER_ACCESS' : 'BUFFER_HANDOFF',
    portType: 'IN',
    face: 'FRONT',
    slot: 1,
    position: structuredClone(normalized.position),
    width: Math.min(normalized.width, 12),
    depth: Math.min(normalized.depth, 12),
    height: Math.min(normalized.height, 12),
    baseWidth: Math.min(normalized.baseWidth ?? normalized.width, 12),
    baseDepth: Math.min(normalized.baseDepth ?? normalized.depth, 12),
    baseHeight: Math.min(normalized.baseHeight ?? normalized.height, 12),
    scale: structuredClone(normalized.scale ?? DEFAULT_ENTITY_SCALE),
    created: true,
    templateNodeName: 'Port_Template',
    domainLabel: normalized.domainLabel,
  }
}

function convertSceneEntity(state: EditorState, editorId: string, objectType: ObjectKind) {
  const lift = state.draftLifts.find((item) => item.editorId === editorId)
  const port = state.draftPorts.find((item) => item.editorId === editorId)
  const backgroundObject = state.draftBackgroundObjects.find((item) => item.editorId === editorId)
  const source = lift ?? port ?? backgroundObject
  const targetCategory = getObjectTypeCategory(state.objectTypeDefinitions, objectType)

  if (!source || !targetCategory || source.objectType === objectType) return state

  const draftLifts = state.draftLifts.filter((item) => item.editorId !== editorId)
  const draftPorts = state.draftPorts.filter((item) => item.editorId !== editorId)
  const draftBackgroundObjects = state.draftBackgroundObjects.filter((item) => item.editorId !== editorId)

  if (targetCategory === 'lift') {
    return applyMutation(state, {
      draftLifts: [...draftLifts, makeLiftFromEntity(source)],
      draftPorts,
      draftBackgroundObjects,
      selectedId: editorId,
    }, 'Object reclassified as Lift')
  }

  if (targetCategory === 'port') {
    return applyMutation(state, {
      draftLifts,
      draftPorts: [...draftPorts, makePortFromEntity(source, state.draftLifts)],
      draftBackgroundObjects,
      selectedId: editorId,
    }, 'Object reclassified as Port')
  }

  return applyMutation(state, {
    draftLifts,
    draftPorts,
    draftBackgroundObjects: [...draftBackgroundObjects, makeBackgroundObjectFromEntity(source, objectType)],
    selectedId: editorId,
  }, `Object reclassified as ${objectType}`)
}

function deriveScene(lifts: LiftEntity[], ports: PortEntity[], backgroundObjects: BackgroundObjectEntity[]) {
  const hydratedPorts = hydratePortPositions(lifts, ports)
  const collisions = detectCollisions(lifts, hydratedPorts, backgroundObjects)
  const validation = [
    ...validateEntities(lifts, hydratedPorts, backgroundObjects),
    ...collisions.map<ValidationIssue>((issue) => ({
      id: issue.id,
      severity: issue.severity,
      targetId: issue.sourceId,
      message: issue.message,
    })),
  ]

  return {
    ports: hydratedPorts,
    collisionIssues: collisions,
    collisionIndex: collisionMap(collisions),
    validationIssues: validation,
  }
}

function historyState(history: EditorSnapshot[], future: EditorSnapshot[]) {
  return {
    history,
    future,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  }
}

function sameSceneEntityLists<T>(left: T[], right: T[]) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function hasPendingSceneChanges(state: Pick<EditorState, 'draftLifts' | 'draftPorts' | 'draftBackgroundObjects' | 'appliedLifts' | 'appliedPorts' | 'appliedBackgroundObjects'>) {
  return !sameSceneEntityLists(state.draftLifts, state.appliedLifts)
    || !sameSceneEntityLists(state.draftPorts, state.appliedPorts)
    || !sameSceneEntityLists(state.draftBackgroundObjects, state.appliedBackgroundObjects)
}

function resolveSelectedId(selectedId: string | null, lifts: LiftEntity[], ports: PortEntity[], backgroundObjects: BackgroundObjectEntity[]) {
  if (!selectedId) return null
  const exists = lifts.some((item) => item.editorId === selectedId)
    || ports.some((item) => item.editorId === selectedId)
    || backgroundObjects.some((item) => item.editorId === selectedId)
  return exists ? selectedId : null
}

function initializeScene(
  bundle: { fileName: string; lifts: LiftEntity[]; ports: PortEntity[]; backgroundObjects: BackgroundObjectEntity[] },
  runtime: SceneRuntime,
  statusMessage: string,
  objectTypeDefinitions: ObjectTypeDefinition[],
) {
  const normalizedBundle = {
    fileName: bundle.fileName,
    lifts: normalizeLiftList(bundle.lifts),
    ports: normalizePortList(bundle.ports),
    backgroundObjects: normalizeBackgroundObjectList(bundle.backgroundObjects),
  }
  const derived = deriveScene(normalizedBundle.lifts, normalizedBundle.ports, normalizedBundle.backgroundObjects)
  const mergedObjectTypeDefinitions = [
    ...objectTypeDefinitions,
    ...collectSceneObjectTypeDefinitions(normalizedBundle).filter((definition) => !objectTypeDefinitions.some((item) => item.name === definition.name)),
  ]
  return {
    fileName: normalizedBundle.fileName,
    objectTypeDefinitions: mergedObjectTypeDefinitions,
    draftLifts: normalizedBundle.lifts,
    draftPorts: derived.ports,
    draftBackgroundObjects: normalizedBundle.backgroundObjects,
    appliedLifts: structuredClone(normalizedBundle.lifts),
    appliedPorts: structuredClone(derived.ports),
    appliedBackgroundObjects: structuredClone(normalizedBundle.backgroundObjects),
    selectedId: null,
    mode: 'select' as const,
    topViewFrame: { ...DEFAULT_TOP_VIEW_FRAME },
    snapEnabled: true,
    runtime,
    validationIssues: derived.validationIssues,
    collisionIssues: derived.collisionIssues,
    collisionIndex: derived.collisionIndex,
    isValidationOpen: false,
    isPreviewOpen: false,
    exportFeedback: { status: 'idle' as const },
    statusMessage,
    hasPendingChanges: false,
    ...historyState([], []),
  }
}

function applyMutation(
  state: EditorState,
  nextScene: Partial<Pick<EditorState, 'draftLifts' | 'draftPorts' | 'draftBackgroundObjects' | 'selectedId' | 'mode'>>,
  statusMessage = 'Unsaved changes',
) {
  const draftLifts = normalizeLiftList(nextScene.draftLifts ?? state.draftLifts)
  const draftBackgroundObjects = normalizeBackgroundObjectList(nextScene.draftBackgroundObjects ?? state.draftBackgroundObjects)
  const draftPortsSource = normalizePortList(nextScene.draftPorts ?? state.draftPorts)
  const derived = deriveScene(draftLifts, draftPortsSource, draftBackgroundObjects)
  const history = [...state.history, createSnapshot(state)].slice(-50)
  const hasPendingChanges = hasPendingSceneChanges({
    draftLifts,
    draftPorts: derived.ports,
    draftBackgroundObjects,
    appliedLifts: state.appliedLifts,
    appliedPorts: state.appliedPorts,
    appliedBackgroundObjects: state.appliedBackgroundObjects,
  })

  return {
    ...state,
    draftLifts,
    draftPorts: derived.ports,
    draftBackgroundObjects,
    selectedId: nextScene.selectedId ?? state.selectedId,
    mode: nextScene.mode ?? state.mode,
    validationIssues: derived.validationIssues,
    collisionIssues: derived.collisionIssues,
    collisionIndex: derived.collisionIndex,
    hasPendingChanges,
    ...updateStatus(statusMessage),
    ...historyState(history, []),
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  fileName: null,
  objectTypeDefinitions: structuredClone(DEFAULT_OBJECT_TYPE_DEFINITIONS),
  draftLifts: [],
  draftPorts: [],
  draftBackgroundObjects: [],
  appliedLifts: [],
  appliedPorts: [],
  appliedBackgroundObjects: [],
  selectedId: null,
  mode: 'select',
  topViewFrame: { ...DEFAULT_TOP_VIEW_FRAME },
  snapEnabled: true,
  validationIssues: [],
  collisionIssues: [],
  collisionIndex: {},
  isValidationOpen: false,
  isPreviewOpen: false,
  statusMessage: 'No file loaded',
  exportFeedback: { status: 'idle' },
  runtime: { pristineScene: null, animations: [] },
  history: [],
  future: [],
  canUndo: false,
  canRedo: false,
  hasPendingChanges: false,
  openDemoScene: () => {
    const demo = createDemoScene()
    set(initializeScene(
      demo.bundle,
      { pristineScene: demo.scene.clone(true), animations: [] },
      'Demo scene loaded',
      get().objectTypeDefinitions,
    ))
  },
  loadFile: async (file) => {
    const loaded = await loadGlbFile(file)
    set(initializeScene(
      loaded.bundle,
      { pristineScene: loaded.pristineScene, animations: loaded.animations },
      `${file.name} loaded`,
      get().objectTypeDefinitions,
    ))
  },
  importFile: async (file) => {
    const state = get()
    if (!state.fileName || !state.runtime.pristineScene) {
      await state.loadFile(file)
      return
    }
    if (state.hasPendingChanges) {
      set({ statusMessage: 'Apply or revert draft changes before importing another GLB' })
      return
    }
    const loaded = await loadGlbFile(file)
    set(buildImportedSceneState(get(), loaded, file.name))
  },
  selectObject: (editorId) => set({ selectedId: editorId }),
  setMode: (mode) => set({ mode }),
  setTopViewFrame: (frame) => set((state) => ({
    topViewFrame: { ...state.topViewFrame, ...frame },
    statusMessage: 'Top view frame updated',
  })),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setValidationOpen: (isValidationOpen) => set({ isValidationOpen }),
  setPreviewOpen: (isPreviewOpen) => set({ isPreviewOpen }),
  addObjectTypeDefinition: (definition) => set((state) => {
    const name = normalizeTypeName(definition.name)
    if (!name) {
      return { statusMessage: 'Type name is required' }
    }
    if (state.objectTypeDefinitions.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      return { statusMessage: `${name} already exists` }
    }
    return {
      objectTypeDefinitions: [...state.objectTypeDefinitions, { name, category: definition.category }],
      statusMessage: `${name} type added`,
    }
  }),
  removeObjectTypeDefinition: (name) => set((state) => {
    if (PROTECTED_OBJECT_TYPES.has(name)) {
      return { statusMessage: `${name} type is protected` }
    }
    const isInUse = state.draftLifts.some((item) => item.objectType === name)
      || state.appliedLifts.some((item) => item.objectType === name)
      || state.draftPorts.some((item) => item.objectType === name)
      || state.appliedPorts.some((item) => item.objectType === name)
      || state.draftBackgroundObjects.some((item) => item.objectType === name)
      || state.appliedBackgroundObjects.some((item) => item.objectType === name)
    if (isInUse) {
      return { statusMessage: `${name} is in use and cannot be removed` }
    }
    return {
      objectTypeDefinitions: state.objectTypeDefinitions.filter((item) => item.name !== name),
      statusMessage: `${name} type removed`,
    }
  }),
  moveEntity: (editorId, x, y) => set((state) => {
    if (state.draftLifts.some((lift) => lift.editorId === editorId)) {
      const target = state.draftLifts.find((lift) => lift.editorId === editorId)
      if (!target) return state
      const snapped = snapLiftToNeighbors(target, x, y, state.draftLifts.filter((lift) => lift.editorId !== editorId), state.snapEnabled)
      const draftLifts = state.draftLifts.map((lift) => lift.editorId === editorId ? { ...lift, position: { ...lift.position, x: snapped.x, y: snapped.y } } : lift)
      return applyMutation(state, { draftLifts, selectedId: editorId }, 'Lift moved')
    }

    if (state.draftPorts.some((port) => port.editorId === editorId)) {
      const target = state.draftPorts.find((port) => port.editorId === editorId)
      if (!target) return state
      const nextLift = findNearestLift(state.draftLifts, x, y)
      if (!nextLift) return state
      const inferred = inferFaceAndSlot(nextLift, { ...target, position: { ...target.position, x, y } })
      const draftPorts = state.draftPorts.map((port) => port.editorId === editorId ? withUpdatedPortPosition(state.draftLifts, {
        ...port,
        parentLiftId: nextLift.editorId,
        domainParentId: nextLift.editorId,
        domainParentType: 'Lift',
        semanticRole: 'LIFT_DOCK',
        face: inferred.face,
        slot: inferred.slot,
      }) : port)
      return applyMutation(state, { draftPorts, selectedId: editorId }, `Port snapped to ${nextLift.id}`)
    }

    return moveBackgroundObject(state, editorId, x, y)
  }),
  moveLift: (editorId, x, y) => {
    get().moveEntity(editorId, x, y)
  },
  rotateLift: (editorId) => set((state) => {
    const draftLifts = state.draftLifts.map((lift) => lift.editorId === editorId ? { ...lift, rotation: (((lift.rotation + 90) % 360) as 0 | 90 | 180 | 270) } : lift)
    return applyMutation(state, { draftLifts }, 'Lift rotated')
  }),
  updateLift: (editorId, patch) => set((state) => {
    const draftLifts = state.draftLifts.map((lift) => lift.editorId === editorId ? { ...lift, ...patch, animation: { ...lift.animation, ...(patch.animation ?? {}) } } : lift)
    return applyMutation(state, { draftLifts }, 'Lift updated')
  }),
  updatePort: (editorId, patch) => set((state) => {
    const draftPorts = state.draftPorts.map((port) => port.editorId === editorId
      ? withUpdatedPortPosition(state.draftLifts, {
        ...port,
        ...patch,
        position: patch.position ? { ...port.position, ...patch.position } : port.position,
      })
      : port)
    return applyMutation(state, { draftPorts }, 'Port updated')
  }),
  updateBackgroundObject: (editorId, patch) => set((state) => {
    const draftBackgroundObjects = state.draftBackgroundObjects.map((entity) => entity.editorId === editorId
      ? { ...entity, ...patch, position: patch.position ? { ...entity.position, ...patch.position } : entity.position }
      : entity)
    return applyMutation(state, { draftBackgroundObjects }, 'Object updated')
  }),
  setObjectType: (editorId, objectType) => set((state) => convertSceneEntity(state, editorId, objectType)),
  duplicateSelectedObject: () => set((state) => duplicateSceneEntity(state)),
  movePortByWorld: (editorId, x, y) => {
    get().moveEntity(editorId, x, y)
  },
  deletePort: (editorId) => set((state) => applyMutation(state, {
    draftPorts: state.draftPorts.map((port) => port.editorId === editorId ? { ...port, deleted: true } : port),
    selectedId: state.selectedId === editorId ? null : state.selectedId,
  }, 'Port deleted')),
  applyDraftChanges: () => set((state) => {
    if (!state.hasPendingChanges) return state
    return {
      appliedLifts: structuredClone(state.draftLifts),
      appliedPorts: structuredClone(state.draftPorts),
      appliedBackgroundObjects: structuredClone(state.draftBackgroundObjects),
      hasPendingChanges: false,
      statusMessage: 'Draft changes applied',
      ...historyState([], []),
    }
  }),
  revertDraftChanges: () => set((state) => {
    if (!state.hasPendingChanges) return state
    const draftLifts = structuredClone(state.appliedLifts)
    const draftBackgroundObjects = structuredClone(state.appliedBackgroundObjects)
    const derived = deriveScene(draftLifts, structuredClone(state.appliedPorts), draftBackgroundObjects)
    return {
      ...state,
      draftLifts,
      draftPorts: derived.ports,
      draftBackgroundObjects,
      selectedId: resolveSelectedId(state.selectedId, draftLifts, derived.ports, draftBackgroundObjects),
      mode: 'select',
      validationIssues: derived.validationIssues,
      collisionIssues: derived.collisionIssues,
      collisionIndex: derived.collisionIndex,
      hasPendingChanges: false,
      statusMessage: 'Draft changes reverted',
      ...historyState([], []),
    }
  }),
  runValidation: () => {
    const state = get()
    const issues = state.validationIssues
    set({
      validationIssues: issues,
      isValidationOpen: true,
      statusMessage: issues.length ? `${issues.length} validation issues` : 'Validation passed',
    })
    return issues
  },
  exportCurrentGlb: async () => {
    const state = get()
    if (state.hasPendingChanges) {
      set({ exportFeedback: { status: 'blocked', message: 'Draft changes are pending. Apply or revert them before export.' } })
      return
    }
    const exportDerived = deriveScene(state.appliedLifts, state.appliedPorts, state.appliedBackgroundObjects)
    const issues = exportDerived.validationIssues.filter((issue) => issue.severity === 'error')
    if (issues.length) {
      set({ exportFeedback: { status: 'blocked', message: 'Applied scene validation failed. Export blocked.' } })
      return
    }

    if (!state.runtime.pristineScene || !state.fileName) {
      set({ exportFeedback: { status: 'error', message: 'No scene loaded.' } })
      return
    }

    set({ exportFeedback: { status: 'exporting', message: 'GLB를 내보내는 중...' } })
    try {
      const previousUrl = get().exportFeedback.downloadUrl
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      const blob = await exportGlb({ pristineScene: state.runtime.pristineScene, lifts: state.appliedLifts, ports: state.appliedPorts, backgroundObjects: state.appliedBackgroundObjects, animations: state.runtime.animations })
      const downloadUrl = URL.createObjectURL(blob)
      set({ exportFeedback: { status: 'success', message: 'Export completed', downloadUrl, fileName: state.fileName.replace(/\.glb$/i, '.edited.glb') } })
    } catch (error) {
      set({ exportFeedback: { status: 'error', message: error instanceof Error ? error.message : 'Export failed' } })
    }
  },
  closeExportFeedback: () => set((state) => {
    if (state.exportFeedback.downloadUrl) URL.revokeObjectURL(state.exportFeedback.downloadUrl)
    return { exportFeedback: { status: 'idle' } }
  }),
  undo: () => set((state) => {
    const previous = state.history.at(-1)
    if (!previous) return state
    const nextHistory = state.history.slice(0, -1)
    const future = [createSnapshot(state), ...state.future].slice(0, 50)
    const snapshot = cloneSnapshot(previous)
    const derived = deriveScene(snapshot.draftLifts, snapshot.draftPorts, snapshot.draftBackgroundObjects)

    return {
      ...state,
      draftLifts: snapshot.draftLifts,
      draftPorts: derived.ports,
      draftBackgroundObjects: snapshot.draftBackgroundObjects,
      validationIssues: derived.validationIssues,
      collisionIssues: derived.collisionIssues,
      collisionIndex: derived.collisionIndex,
      hasPendingChanges: hasPendingSceneChanges({
        draftLifts: snapshot.draftLifts,
        draftPorts: derived.ports,
        draftBackgroundObjects: snapshot.draftBackgroundObjects,
        appliedLifts: state.appliedLifts,
        appliedPorts: state.appliedPorts,
        appliedBackgroundObjects: state.appliedBackgroundObjects,
      }),
      statusMessage: 'Undo applied',
      ...historyState(nextHistory, future),
    }
  }),
  redo: () => set((state) => {
    const [next, ...futureTail] = state.future
    if (!next) return state
    const history = [...state.history, createSnapshot(state)].slice(-50)
    const snapshot = cloneSnapshot(next)
    const derived = deriveScene(snapshot.draftLifts, snapshot.draftPorts, snapshot.draftBackgroundObjects)

    return {
      ...state,
      draftLifts: snapshot.draftLifts,
      draftPorts: derived.ports,
      draftBackgroundObjects: snapshot.draftBackgroundObjects,
      validationIssues: derived.validationIssues,
      collisionIssues: derived.collisionIssues,
      collisionIndex: derived.collisionIndex,
      hasPendingChanges: hasPendingSceneChanges({
        draftLifts: snapshot.draftLifts,
        draftPorts: derived.ports,
        draftBackgroundObjects: snapshot.draftBackgroundObjects,
        appliedLifts: state.appliedLifts,
        appliedPorts: state.appliedPorts,
        appliedBackgroundObjects: state.appliedBackgroundObjects,
      }),
      statusMessage: 'Redo applied',
      ...historyState(history, futureTail),
    }
  }),
}))
