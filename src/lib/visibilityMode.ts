import type { LiftEntity, PortEntity, VisibilityMode } from '../types'

function roundCoordinate(value: number) {
  return Math.round(value * 10) / 10
}

export function computeVisibilityPivot(ports: PortEntity[], lifts: LiftEntity[]) {
  const activePortZ = ports.filter((port) => !port.deleted).map((port) => port.position.z)
  if (activePortZ.length > 0) return roundCoordinate((Math.min(...activePortZ) + Math.max(...activePortZ)) / 2)

  const liftZ = lifts.map((lift) => lift.position.z)
  if (liftZ.length > 0) return roundCoordinate((Math.min(...liftZ) + Math.max(...liftZ)) / 2)

  return 0
}

export function matchesVisibilityMode(port: PortEntity, visibilityMode: VisibilityMode, pivotZ: number) {
  return visibilityMode === 'TOP_ONLY' ? port.position.z >= pivotZ : port.position.z < pivotZ
}

export function visibilityModeLabel(visibilityMode: VisibilityMode, pivotZ: number) {
  return visibilityMode === 'TOP_ONLY' ? `Z ≥ ${pivotZ}` : `Z < ${pivotZ}`
}

export function visibilityModeToggleLabel(visibilityMode: VisibilityMode, pivotZ: number) {
  return visibilityMode === 'TOP_ONLY' ? `Z+ (≥ ${pivotZ})` : `Z- (< ${pivotZ})`
}
