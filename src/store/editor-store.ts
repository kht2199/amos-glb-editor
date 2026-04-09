import { create } from 'zustand'
import * as THREE from 'three'
import { detectCollisions, collisionMap } from '../lib/collision'
import { DEFAULT_ANIMATION, STORAGE_KEY } from '../lib/constants'
import { createDemoScene } from '../lib/demoScene'
import { exportGlb, loadGlbFile } from '../lib/glb'
import { computePortPosition, findNearestLift, inferFaceAndSlot, snapLiftToNeighbors } from '../lib/utils'
import { validateEntities } from '../lib/validation'
import type {
  CollisionIssue,
  DomainParentType,
  EditorMode,
  EditorSnapshot,
  Face,
  LiftEntity,
  ObjectKind,
  PortEntity,
  PortLevel,
  PortSemanticRole,
  PortType,
  ReadOnlyEntity,
  SerializableSession,
  ValidationIssue,
  VisibilityMode,
} from '../types'

interface ExportFeedback {
  status: 'idle' | 'exporting' | 'success' | 'error' | 'blocked'
  message?: string
  downloadUrl?: string
  fileName?: string
}

interface AddPortDraft {
  parentLiftId: string
  domainParentId: string
  domainParentType: DomainParentType
  level: PortLevel
  face: Face
  slot: number
  id: string
  portType: PortType
  semanticRole: PortSemanticRole
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
  draftReadonlyObjects: ReadOnlyEntity[]
  appliedLifts: LiftEntity[]
  appliedPorts: PortEntity[]
  appliedReadonlyObjects: ReadOnlyEntity[]
  selectedId: string | null
  visibilityMode: VisibilityMode
  mode: EditorMode
  snapEnabled: boolean
  validationIssues: ValidationIssue[]
  collisionIssues: CollisionIssue[]
  collisionIndex: Record<string, CollisionIssue[]>
  isValidationOpen: boolean
  isPreviewOpen: boolean
  saveState: 'saved' | 'unsaved'
  statusMessage: string
  exportFeedback: ExportFeedback
  runtime: SceneRuntime
  addPortDraft: AddPortDraft | null
  history: EditorSnapshot[]
  future: EditorSnapshot[]
  canUndo: boolean
  canRedo: boolean
  hasPendingChanges: boolean
  openDemoScene: () => void
  loadFile: (file: File) => Promise<void>
  selectObject: (editorId: string | null) => void
  setMode: (mode: EditorMode) => void
  setVisibilityMode: (mode: VisibilityMode) => void
  setSnapEnabled: (enabled: boolean) => void
  setValidationOpen: (open: boolean) => void
  setPreviewOpen: (open: boolean) => void
  moveLift: (editorId: string, x: number, y: number) => void
  rotateLift: (editorId: string) => void
  updateLift: (editorId: string, patch: Partial<LiftEntity>) => void
  updatePort: (editorId: string, patch: Partial<PortEntity>) => void
  setObjectType: (editorId: string, objectType: ObjectKind) => void
  movePortByWorld: (editorId: string, x: number, y: number) => void
  deletePort: (editorId: string) => void
  beginAddPort: () => void
  updateAddPortDraft: (patch: Partial<AddPortDraft>) => void
  confirmAddPort: () => void
  cancelAddPort: () => void
  runValidation: () => ValidationIssue[]
  saveSession: () => void
  exportCurrentGlb: () => Promise<void>
  closeExportFeedback: () => void
  undo: () => void
  redo: () => void
}

function markUnsaved(message = 'Unsaved changes') {
  return {
    saveState: 'unsaved' as const,
    statusMessage: message,
  }
}

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    draftLifts: structuredClone(snapshot.draftLifts),
    draftPorts: structuredClone(snapshot.draftPorts),
    draftReadonlyObjects: structuredClone(snapshot.draftReadonlyObjects),
    visibilityMode: snapshot.visibilityMode,
  }
}

function createSnapshot(state: Pick<EditorState, 'draftLifts' | 'draftPorts' | 'draftReadonlyObjects' | 'visibilityMode'>): EditorSnapshot {
  return cloneSnapshot({
    draftLifts: state.draftLifts,
    draftPorts: state.draftPorts,
    draftReadonlyObjects: state.draftReadonlyObjects,
    visibilityMode: state.visibilityMode,
  })
}

function hydratePortPositions(lifts: LiftEntity[], ports: PortEntity[]) {
  return ports.map((port) => {
    if (port.domainParentType !== 'Lift' || !port.parentLiftId) return port
    const lift = lifts.find((item) => item.editorId === port.parentLiftId)
    if (!lift || port.deleted) return port
    return {
      ...port,
      position: computePortPosition(lift, port.face, port.slot, port.level),
    }
  })
}

function withUpdatedPortPosition(lifts: LiftEntity[], port: PortEntity) {
  if (port.domainParentType !== 'Lift' || !port.parentLiftId) return port
  const lift = lifts.find((item) => item.editorId === port.parentLiftId)
  if (!lift || port.deleted) return port
  return {
    ...port,
    position: computePortPosition(lift, port.face, port.slot, port.level),
  }
}

function makeAddPortDraft(lifts: LiftEntity[], selectedId: string | null): AddPortDraft | null {
  const lift = lifts.find((item) => item.editorId === selectedId) ?? lifts[0]
  if (!lift) return null
  return {
    parentLiftId: lift.editorId,
    domainParentId: lift.editorId,
    domainParentType: 'Lift',
    level: 'TOP',
    face: 'FRONT',
    slot: 1,
    id: `port_${crypto.randomUUID().slice(0, 8)}`,
    portType: 'IN',
    semanticRole: 'LIFT_DOCK',
  }
}

const READONLY_OBJECT_TYPES: ReadOnlyEntity['objectType'][] = ['Bridge', 'Rail', 'Stocker', 'Transport']

type SceneEntity = LiftEntity | PortEntity | ReadOnlyEntity

function isReadonlyObjectType(objectType: ObjectKind): objectType is ReadOnlyEntity['objectType'] {
  return READONLY_OBJECT_TYPES.includes(objectType as ReadOnlyEntity['objectType'])
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

function makeReadonlyFromEntity(entity: SceneEntity, objectType: ReadOnlyEntity['objectType']): ReadOnlyEntity {
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
    readOnly: true,
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
      level: entity.position.z >= nearestLift.position.z + nearestLift.height / 2 ? 'TOP' : 'BOTTOM',
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
    const inferred = inferFaceAndSlot(nearestLift, provisional)
    return withUpdatedPortPosition(remainingLifts.length ? [...remainingLifts, nearestLift] : [nearestLift], {
      ...provisional,
      face: inferred.face,
      slot: inferred.slot,
    })
  }

  const externalParentType = isReadonlyObjectType(entity.objectType) ? entity.objectType : 'Transport'
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
    level: 'BOTTOM',
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
  const readonlyObject = state.draftReadonlyObjects.find((item) => item.editorId === editorId)
  const source = lift ?? port ?? readonlyObject

  if (!source || source.objectType === objectType) {
    if (readonlyObject && isReadonlyObjectType(objectType) && readonlyObject.objectType !== objectType) {
      return applyMutation(state, {
        draftReadonlyObjects: state.draftReadonlyObjects.map((item) => item.editorId === editorId ? { ...item, objectType } : item),
        selectedId: editorId,
      }, `Object type updated to ${objectType}`)
    }
    return state
  }

  const draftLifts = state.draftLifts.filter((item) => item.editorId !== editorId)
  const draftPorts = state.draftPorts.filter((item) => item.editorId !== editorId)
  const draftReadonlyObjects = state.draftReadonlyObjects.filter((item) => item.editorId !== editorId)

  if (objectType === 'Lift') {
    return applyMutation(state, {
      draftLifts: [...draftLifts, makeLiftFromEntity(source)],
      draftPorts,
      draftReadonlyObjects,
      selectedId: editorId,
    }, 'Object reclassified as Lift')
  }

  if (objectType === 'Port') {
    return applyMutation(state, {
      draftLifts,
      draftPorts: [...draftPorts, makePortFromEntity(source, state.draftLifts)],
      draftReadonlyObjects,
      selectedId: editorId,
    }, 'Object reclassified as Port')
  }

  return applyMutation(state, {
    draftLifts,
    draftPorts,
    draftReadonlyObjects: [...draftReadonlyObjects, makeReadonlyFromEntity(source, objectType)],
    selectedId: editorId,
  }, `Object reclassified as ${objectType}`)
}

function serializableSession(state: EditorState): SerializableSession | null {
  if (!state.fileName) return null
  return {
    fileName: state.fileName,
    visibilityMode: state.visibilityMode,
    snapEnabled: state.snapEnabled,
    lifts: state.draftLifts,
    ports: state.draftPorts,
    readonlyObjects: state.draftReadonlyObjects,
  }
}

function deriveScene(lifts: LiftEntity[], ports: PortEntity[], readonlyObjects: ReadOnlyEntity[]) {
  const hydratedPorts = hydratePortPositions(lifts, ports)
  const collisions = detectCollisions(lifts, hydratedPorts, readonlyObjects)
  const validation = [
    ...validateEntities(lifts, hydratedPorts, readonlyObjects),
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

function initializeScene(bundle: { fileName: string; lifts: LiftEntity[]; ports: PortEntity[]; readonlyObjects: ReadOnlyEntity[] }, runtime: SceneRuntime, statusMessage: string) {
  const derived = deriveScene(bundle.lifts, bundle.ports, bundle.readonlyObjects)
  return {
    fileName: bundle.fileName,
    draftLifts: bundle.lifts,
    draftPorts: derived.ports,
    draftReadonlyObjects: bundle.readonlyObjects,
    appliedLifts: structuredClone(bundle.lifts),
    appliedPorts: structuredClone(derived.ports),
    appliedReadonlyObjects: structuredClone(bundle.readonlyObjects),
    selectedId: null,
    mode: 'select' as const,
    visibilityMode: 'TOP_ONLY' as const,
    snapEnabled: true,
    runtime,
    validationIssues: derived.validationIssues,
    collisionIssues: derived.collisionIssues,
    collisionIndex: derived.collisionIndex,
    isValidationOpen: false,
    isPreviewOpen: false,
    exportFeedback: { status: 'idle' as const },
    saveState: 'saved' as const,
    statusMessage,
    addPortDraft: null,
    hasPendingChanges: false,
    ...historyState([], []),
  }
}

function applyMutation(
  state: EditorState,
  nextScene: Partial<Pick<EditorState, 'draftLifts' | 'draftPorts' | 'draftReadonlyObjects' | 'visibilityMode' | 'selectedId' | 'mode' | 'addPortDraft'>>,
  statusMessage = 'Unsaved changes',
) {
  const draftLifts = nextScene.draftLifts ?? state.draftLifts
  const draftReadonlyObjects = nextScene.draftReadonlyObjects ?? state.draftReadonlyObjects
  const visibilityMode = nextScene.visibilityMode ?? state.visibilityMode
  const draftPortsSource = nextScene.draftPorts ?? state.draftPorts
  const derived = deriveScene(draftLifts, draftPortsSource, draftReadonlyObjects)
  const history = [...state.history, createSnapshot(state)].slice(-50)

  return {
    ...state,
    draftLifts,
    draftPorts: derived.ports,
    draftReadonlyObjects,
    visibilityMode,
    selectedId: nextScene.selectedId ?? state.selectedId,
    mode: nextScene.mode ?? state.mode,
    addPortDraft: nextScene.addPortDraft ?? state.addPortDraft,
    validationIssues: derived.validationIssues,
    collisionIssues: derived.collisionIssues,
    collisionIndex: derived.collisionIndex,
    hasPendingChanges: true,
    ...markUnsaved(statusMessage),
    ...historyState(history, []),
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  fileName: null,
  draftLifts: [],
  draftPorts: [],
  draftReadonlyObjects: [],
  appliedLifts: [],
  appliedPorts: [],
  appliedReadonlyObjects: [],
  selectedId: null,
  visibilityMode: 'TOP_ONLY',
  mode: 'select',
  snapEnabled: true,
  validationIssues: [],
  collisionIssues: [],
  collisionIndex: {},
  isValidationOpen: false,
  isPreviewOpen: false,
  saveState: 'saved',
  statusMessage: 'No file loaded',
  exportFeedback: { status: 'idle' },
  runtime: { workingScene: null, pristineScene: null, animations: [] },
  addPortDraft: null,
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
  setMode: (mode) => set((state) => ({
    mode,
    addPortDraft: mode === 'addPort' ? state.addPortDraft ?? makeAddPortDraft(state.draftLifts, state.selectedId) : null,
  })),
  setVisibilityMode: (visibilityMode) => set({ visibilityMode }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setValidationOpen: (isValidationOpen) => set({ isValidationOpen }),
  setPreviewOpen: (isPreviewOpen) => set({ isPreviewOpen }),
  moveLift: (editorId, x, y) => set((state) => {
    const target = state.draftLifts.find((lift) => lift.editorId === editorId)
    if (!target) return state
    const snapped = snapLiftToNeighbors(target, x, y, state.draftLifts.filter((lift) => lift.editorId !== editorId), state.snapEnabled)
    const draftLifts = state.draftLifts.map((lift) => lift.editorId === editorId ? { ...lift, position: { ...lift.position, x: snapped.x, y: snapped.y } } : lift)
    return applyMutation(state, { draftLifts }, 'Lift moved')
  }),
  rotateLift: (editorId) => set((state) => {
    const draftLifts = state.draftLifts.map((lift) => lift.editorId === editorId ? { ...lift, rotation: (((lift.rotation + 90) % 360) as 0 | 90 | 180 | 270) } : lift)
    return applyMutation(state, { draftLifts }, 'Lift rotated')
  }),
  updateLift: (editorId, patch) => set((state) => {
    const draftLifts = state.draftLifts.map((lift) => lift.editorId === editorId ? { ...lift, ...patch, animation: { ...lift.animation, ...(patch.animation ?? {}) } } : lift)
    return applyMutation(state, { draftLifts }, 'Lift updated')
  }),
  updatePort: (editorId, patch) => set((state) => {
    const draftPorts = state.draftPorts.map((port) => port.editorId === editorId ? withUpdatedPortPosition(state.draftLifts, { ...port, ...patch }) : port)
    return applyMutation(state, { draftPorts }, 'Port updated')
  }),
  setObjectType: (editorId, objectType) => set((state) => convertSceneEntity(state, editorId, objectType)),
  movePortByWorld: (editorId, x, y) => set((state) => {
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
  }),
  deletePort: (editorId) => set((state) => applyMutation(state, {
    draftPorts: state.draftPorts.map((port) => port.editorId === editorId ? { ...port, deleted: true } : port),
    selectedId: state.selectedId === editorId ? null : state.selectedId,
  }, 'Port deleted')),
  beginAddPort: () => set((state) => ({ mode: 'addPort', addPortDraft: makeAddPortDraft(state.draftLifts, state.selectedId) })),
  updateAddPortDraft: (patch) => set((state) => ({ addPortDraft: state.addPortDraft ? { ...state.addPortDraft, ...patch } : null })),
  confirmAddPort: () => set((state) => {
    const draft = state.addPortDraft
    const lift = draft ? state.draftLifts.find((item) => item.editorId === draft.parentLiftId) : null
    if (!draft || !lift) return state

    const port: PortEntity = withUpdatedPortPosition(state.draftLifts, {
      id: draft.id,
      editorId: crypto.randomUUID(),
      label: draft.id,
      objectType: 'Port',
      nodeName: draft.id,
      parentLiftId: draft.parentLiftId,
      domainParentId: draft.domainParentId,
      domainParentType: draft.domainParentType,
      semanticRole: draft.semanticRole,
      portType: draft.portType,
      level: draft.level,
      face: draft.face,
      slot: draft.slot,
      position: computePortPosition(lift, draft.face, draft.slot, draft.level),
      width: 8,
      depth: 8,
      height: 8,
      created: true,
      templateNodeName: 'Port_Template',
    })

    return applyMutation(state, {
      draftPorts: [...state.draftPorts, port],
      selectedId: port.editorId,
      mode: 'select',
      addPortDraft: null,
    }, 'Port created')
  }),
  cancelAddPort: () => set({ mode: 'select', addPortDraft: null }),
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
  saveSession: () => {
    const state = get()
    const snapshot = serializableSession(state)
    if (snapshot) localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    set({ saveState: 'saved', statusMessage: 'Session saved' })
  },
  exportCurrentGlb: async () => {
    const issues = get().runValidation().filter((issue) => issue.severity === 'error')
    if (issues.length) {
      set({ exportFeedback: { status: 'blocked', message: 'Validation failed. Export blocked.' } })
      return
    }

    const state = get()
    if (!state.runtime.pristineScene || !state.fileName) {
      set({ exportFeedback: { status: 'error', message: 'No scene loaded.' } })
      return
    }

    set({ exportFeedback: { status: 'exporting', message: 'GLB를 내보내는 중...' } })
    try {
      const previousUrl = get().exportFeedback.downloadUrl
      if (previousUrl) URL.revokeObjectURL(previousUrl)
      const blob = await exportGlb({ pristineScene: state.runtime.pristineScene, lifts: state.draftLifts, ports: state.draftPorts, readonlyObjects: state.draftReadonlyObjects, animations: state.runtime.animations })
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
    const derived = deriveScene(snapshot.draftLifts, snapshot.draftPorts, snapshot.draftReadonlyObjects)

    return {
      ...state,
      draftLifts: snapshot.draftLifts,
      draftPorts: derived.ports,
      draftReadonlyObjects: snapshot.draftReadonlyObjects,
      visibilityMode: snapshot.visibilityMode,
      validationIssues: derived.validationIssues,
      collisionIssues: derived.collisionIssues,
      collisionIndex: derived.collisionIndex,
      hasPendingChanges: true,
      statusMessage: 'Undo applied',
      saveState: 'unsaved',
      ...historyState(nextHistory, future),
    }
  }),
  redo: () => set((state) => {
    const [next, ...futureTail] = state.future
    if (!next) return state
    const history = [...state.history, createSnapshot(state)].slice(-50)
    const snapshot = cloneSnapshot(next)
    const derived = deriveScene(snapshot.draftLifts, snapshot.draftPorts, snapshot.draftReadonlyObjects)

    return {
      ...state,
      draftLifts: snapshot.draftLifts,
      draftPorts: derived.ports,
      draftReadonlyObjects: snapshot.draftReadonlyObjects,
      visibilityMode: snapshot.visibilityMode,
      validationIssues: derived.validationIssues,
      collisionIssues: derived.collisionIssues,
      collisionIndex: derived.collisionIndex,
      hasPendingChanges: true,
      statusMessage: 'Redo applied',
      saveState: 'unsaved',
      ...historyState(history, futureTail),
    }
  }),
}))
