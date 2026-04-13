export type ObjectKind = string
export type PortType = 'IN' | 'OUT' | 'INOUT'
export type Face = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT'
export type EditorMode = 'select' | 'move'
export type ValidationSeverity = 'error' | 'warning'
export type DomainParentType = string
export type PortSemanticRole = 'LIFT_DOCK' | 'STOCKER_ACCESS' | 'TOOL_LOAD' | 'BUFFER_HANDOFF'
export type TopViewAxisDirection = 'right' | 'left' | 'up' | 'down'
export type TopViewEditPlane = 'xy' | 'xz' | 'yz'
export type ObjectTypeCategory = 'lift' | 'port' | 'background'

export interface ObjectTypeDefinition {
  name: string
  category: ObjectTypeCategory
}

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

export interface BackgroundObjectEntity extends BaseEntity {
  objectType: string
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

export interface TopViewFrame {
  originX: number
  originY: number
  xAxisDirection: Extract<TopViewAxisDirection, 'right' | 'left'>
  yAxisDirection: Extract<TopViewAxisDirection, 'up' | 'down'>
  editPlane: TopViewEditPlane
}

export interface EditorSnapshot {
  draftLifts: LiftEntity[]
  draftPorts: PortEntity[]
  draftBackgroundObjects: BackgroundObjectEntity[]
}

export interface SceneBundle {
  fileName: string
  lifts: LiftEntity[]
  ports: PortEntity[]
  backgroundObjects: BackgroundObjectEntity[]
  originalAnimationsCount: number
}
