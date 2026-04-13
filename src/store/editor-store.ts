import { create } from 'zustand'
import * as THREE from 'three'
import { detectCollisions, collisionMap } from '../lib/collision'
import { DEFAULT_ANIMATION } from '../lib/constants'
import { createDemoScene } from '../lib/demoScene'
import { exportGlb, loadGlbFile } from '../lib/glb'
import { computePortPosition, findNearestLift, inferFaceAndSlot, snapLiftToNeighbors } from '../lib/utils'
import { validateEntities } from '../lib/validation'
import type {
  CollisionIssue,
  EditorMode,
  EditorSnapshot,
  LiftEntity,
  ObjectKind,
  PortEntity,
  BackgroundObjectEntity,
  ValidationIssue,
} from '../types'

interface ExportFeedback {
  status: 'idle' | 'exporting' | 'success' | 'error' | 'blocked'
  message?: string
  downloadUrl?: string
  fileName?: string
}

interface SceneRuntime {
  workingScene: THREE.Group | null
  pristineScene: THREE.Group | null
  animations: THREE.AnimationClip[]
}

interface EditorState {
  fileName: string | null
  draftLifts: LiftEntity[]
  draftPorts: PortEntity[]
  draftBackgroundObjects: BackgroundObjectEntity[]
  appliedLifts: LiftEntity[]
  appliedPorts: PortEntity[]
  appliedBackgroundObjects: BackgroundObjectEntity[]
  selectedId: string | null
  mode: EditorMode
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
  selectObject: (editorId: string | null) => void
  setMode: (mode: EditorMode) => void
  setSnapEnabled: (enabled: boolean) => void
  setValidationOpen: (open: boolean) => void
  setPreviewOpen: (open: boolean) => void
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

function moveBackgroundObject(state: EditorState, editorId: string, x: number, y: number) {
  const target = state.draftBackgroundObjects.find((item) => item.editorId === editorId)
  if (!target) return state
  const draftBackgroundObjects = state.draftBackgroundObjects.map((item) => item.editorId === editorId
    ? { ...item, position: { ...item.position, x, y } }
    : item)
  return applyMutation(state, { draftBackgroundObjects, selectedId: editorId }, `${target.objectType} moved`)
}

const BACKGROUND_OBJECT_TYPES: BackgroundObjectEntity['objectType'][] = ['Bridge', 'Rail', 'Stocker', 'Transport']

type SceneEntity = LiftEntity | PortEntity | BackgroundObjectEntity

const DUPLICATE_OFFSET = 20

function isBackgroundObjectType(objectType: ObjectKind): objectType is BackgroundObjectEntity['objectType'] {
  return BACKGROUND_OBJECT_TYPES.includes(objectType as BackgroundObjectEntity['objectType'])
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
  const baseAnimation = 'animation' in entity ? entity.animation : undefined
  const slotsPerFace = 'slotsPerFace' in entity ? entity.slotsPerFace : Math.max(2, Math.round(Math.max(entity.width, entity.depth) / 10))

  return {
    id: entity.id,
    editorId: entity.editorId,
    label: entity.label,
    objectType: 'Lift',
    nodeName: entity.nodeName,
    position: structuredClone(entity.position),
    width: entity.width,
    depth: entity.depth,
    height: entity.height,
    rotation: 'rotation' in entity ? entity.rotation : 0,
    slotsPerFace,
    animation: baseAnimation
      ? { ...DEFAULT_ANIMATION, ...baseAnimation }
      : { ...DEFAULT_ANIMATION, enabled: true, minZ: 0, maxZ: Math.max(entity.height, DEFAULT_ANIMATION.maxZ) },
  }
}

function makeBackgroundObjectFromEntity(entity: SceneEntity, objectType: BackgroundObjectEntity['objectType']): BackgroundObjectEntity {
  return {
    id: entity.id,
    editorId: entity.editorId,
    label: entity.label,
    objectType,
    nodeName: entity.nodeName,
    position: structuredClone(entity.position),
    width: entity.width,
    depth: entity.depth,
    height: entity.height,
    domainLabel: entity.domainLabel,
  }
}

function makePortFromEntity(entity: SceneEntity, lifts: LiftEntity[]): PortEntity {
  const remainingLifts = lifts.filter((lift) => lift.editorId !== entity.editorId)
  const nearestLift = findNearestLift(remainingLifts, entity.position.x, entity.position.y)

  if (nearestLift) {
    const provisional: PortEntity = {
      id: entity.id,
      editorId: entity.editorId,
      label: entity.label,
      objectType: 'Port',
      nodeName: entity.nodeName,
      parentLiftId: nearestLift.editorId,
      domainParentId: nearestLift.editorId,
      domainParentType: 'Lift',
      semanticRole: 'LIFT_DOCK',
      portType: 'IN',
      face: 'FRONT',
      slot: 1,
      position: structuredClone(entity.position),
      zOffset: entity.position.z - nearestLift.position.z,
      width: Math.min(entity.width, 12),
      depth: Math.min(entity.depth, 12),
      height: Math.min(entity.height, 12),
      created: true,
      templateNodeName: 'Port_Template',
      domainLabel: entity.domainLabel,
    }
    const inferred = inferFaceAndSlot(nearestLift, provisional)
    return withUpdatedPortPosition(remainingLifts.length ? [...remainingLifts, nearestLift] : [nearestLift], {
      ...provisional,
      face: inferred.face,
      slot: inferred.slot,
    })
  }

  const externalParentType = isBackgroundObjectType(entity.objectType) ? entity.objectType : 'Transport'
  return {
    id: entity.id,
    editorId: entity.editorId,
    label: entity.label,
    objectType: 'Port',
    nodeName: entity.nodeName,
    parentLiftId: undefined,
    domainParentId: entity.editorId,
    domainParentType: externalParentType,
    semanticRole: externalParentType === 'Stocker' ? 'STOCKER_ACCESS' : 'BUFFER_HANDOFF',
    portType: 'IN',
    face: 'FRONT',
    slot: 1,
    position: structuredClone(entity.position),
    width: Math.min(entity.width, 12),
    depth: Math.min(entity.depth, 12),
    height: Math.min(entity.height, 12),
    created: true,
    templateNodeName: 'Port_Template',
    domainLabel: entity.domainLabel,
  }
}

function convertSceneEntity(state: EditorState, editorId: string, objectType: ObjectKind) {
  const lift = state.draftLifts.find((item) => item.editorId === editorId)
  const port = state.draftPorts.find((item) => item.editorId === editorId)
  const backgroundObject = state.draftBackgroundObjects.find((item) => item.editorId === editorId)
  const source = lift ?? port ?? backgroundObject

  if (!source || source.objectType === objectType) {
    if (backgroundObject && isBackgroundObjectType(objectType) && backgroundObject.objectType !== objectType) {
      return applyMutation(state, {
        draftBackgroundObjects: state.draftBackgroundObjects.map((item) => item.editorId === editorId ? { ...item, objectType } : item),
        selectedId: editorId,
      }, `Object type updated to ${objectType}`)
    }
    return state
  }

  const draftLifts = state.draftLifts.filter((item) => item.editorId !== editorId)
  const draftPorts = state.draftPorts.filter((item) => item.editorId !== editorId)
  const draftBackgroundObjects = state.draftBackgroundObjects.filter((item) => item.editorId !== editorId)

  if (objectType === 'Lift') {
    return applyMutation(state, {
      draftLifts: [...draftLifts, makeLiftFromEntity(source)],
      draftPorts,
      draftBackgroundObjects,
      selectedId: editorId,
    }, 'Object reclassified as Lift')
  }

  if (objectType === 'Port') {
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

function initializeScene(bundle: { fileName: string; lifts: LiftEntity[]; ports: PortEntity[]; backgroundObjects: BackgroundObjectEntity[] }, runtime: SceneRuntime, statusMessage: string) {
  const derived = deriveScene(bundle.lifts, bundle.ports, bundle.backgroundObjects)
  return {
    fileName: bundle.fileName,
    draftLifts: bundle.lifts,
    draftPorts: derived.ports,
    draftBackgroundObjects: bundle.backgroundObjects,
    appliedLifts: structuredClone(bundle.lifts),
    appliedPorts: structuredClone(derived.ports),
    appliedBackgroundObjects: structuredClone(bundle.backgroundObjects),
    selectedId: null,
    mode: 'select' as const,
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
  const draftLifts = nextScene.draftLifts ?? state.draftLifts
  const draftBackgroundObjects = nextScene.draftBackgroundObjects ?? state.draftBackgroundObjects
  const draftPortsSource = nextScene.draftPorts ?? state.draftPorts
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
  draftLifts: [],
  draftPorts: [],
  draftBackgroundObjects: [],
  appliedLifts: [],
  appliedPorts: [],
  appliedBackgroundObjects: [],
  selectedId: null,
  mode: 'select',
  snapEnabled: true,
  validationIssues: [],
  collisionIssues: [],
  collisionIndex: {},
  isValidationOpen: false,
  isPreviewOpen: false,
  statusMessage: 'No file loaded',
  exportFeedback: { status: 'idle' },
  runtime: { workingScene: null, pristineScene: null, animations: [] },
  history: [],
  future: [],
  canUndo: false,
  canRedo: false,
  hasPendingChanges: false,
  openDemoScene: () => {
    const demo = createDemoScene()
    set(initializeScene(
      demo.bundle,
      { workingScene: demo.scene, pristineScene: demo.scene.clone(true), animations: [] },
      'Demo scene loaded',
    ))
  },
  loadFile: async (file) => {
    const loaded = await loadGlbFile(file)
    set(initializeScene(
      loaded.bundle,
      { workingScene: loaded.workingScene, pristineScene: loaded.pristineScene, animations: loaded.animations },
      `${file.name} loaded`,
    ))
  },
  selectObject: (editorId) => set({ selectedId: editorId }),
  setMode: (mode) => set({ mode }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setValidationOpen: (isValidationOpen) => set({ isValidationOpen }),
  setPreviewOpen: (isPreviewOpen) => set({ isPreviewOpen }),
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
