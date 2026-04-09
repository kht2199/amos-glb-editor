export type ObjectKind = 'Lift' | 'Port' | 'Bridge' | 'Rail' | 'Stocker' | 'Transport'
export type PortType = 'IN' | 'OUT' | 'INOUT'
export type PortLevel = 'TOP' | 'BOTTOM'
export type Face = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT'
export type VisibilityMode = 'TOP_ONLY' | 'BOTTOM_ONLY'
export type EditorMode = 'select' | 'move'
export type ValidationSeverity = 'error' | 'warning'
export type DomainParentType = 'Lift' | 'Stocker' | 'Transport' | 'Bridge' | 'Rail'
export type PortSemanticRole = 'LIFT_DOCK' | 'STOCKER_ACCESS' | 'TOOL_LOAD' | 'BUFFER_HANDOFF'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface EditorAnimation {
  enabled: boolean
  speed: number
  initialPosition: number
  initialDirection: 'UP' | 'DOWN'
  acceleration: number
  easing: 'cubicInOut'
  minZ: number
  maxZ: number
}

export interface BaseEntity {
  id: string
  objectType: ObjectKind
  label: string
  position: Vec3
  width: number
  depth: number
  height: number
  nodeName: string
  editorId: string
  domainLabel?: string
  readOnly?: boolean
}

export interface LiftEntity extends BaseEntity {
  objectType: 'Lift'
  rotation: 0 | 90 | 180 | 270
  slotsPerFace: number
  animation: EditorAnimation
}

export interface PortEntity extends BaseEntity {
  objectType: 'Port'
  portType: PortType
  semanticRole: PortSemanticRole
  level: PortLevel
  face: Face
  slot: number
  parentLiftId?: string
  domainParentId: string
  domainParentType: DomainParentType
  attachedToPortId?: string
  created: boolean
  deleted?: boolean
  templateNodeName?: string
  zOffset?: number
}

export interface ReadOnlyEntity extends BaseEntity {
  objectType: 'Bridge' | 'Rail' | 'Stocker' | 'Transport'
  readOnly: true
}

export interface ValidationIssue {
  id: string
  targetId?: string
  severity: ValidationSeverity
  message: string
}

export interface CollisionIssue {
  id: string
  sourceId: string
  targetId: string
  severity: 'error' | 'warning'
  message: string
}

export interface SerializableSession {
  fileName: string
  visibilityMode: VisibilityMode
  snapEnabled: boolean
  lifts: LiftEntity[]
  ports: PortEntity[]
  readonlyObjects: ReadOnlyEntity[]
}

export interface EditorSnapshot {
  draftLifts: LiftEntity[]
  draftPorts: PortEntity[]
  draftReadonlyObjects: ReadOnlyEntity[]
  visibilityMode: VisibilityMode
}

export interface SceneBundle {
  fileName: string
  lifts: LiftEntity[]
  ports: PortEntity[]
  readonlyObjects: ReadOnlyEntity[]
  originalAnimationsCount: number
}
