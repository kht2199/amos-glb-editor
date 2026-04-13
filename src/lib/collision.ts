import type { CollisionIssue, LiftEntity, PortEntity, BackgroundObjectEntity } from '../types'
import { worldToLocal } from './utils'

interface Rect {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function rectFromEntity(entity: { position: { x: number; y: number }; width: number; depth: number }): Rect {
  return {
    minX: entity.position.x - entity.width / 2,
    maxX: entity.position.x + entity.width / 2,
    minY: entity.position.y - entity.depth / 2,
    maxY: entity.position.y + entity.depth / 2,
  }
}

function intersects(a: Rect, b: Rect, padding = 0) {
  return !(a.maxX <= b.minX + padding || a.minX >= b.maxX - padding || a.maxY <= b.minY + padding || a.minY >= b.maxY - padding)
}

export function detectCollisions(lifts: LiftEntity[], ports: PortEntity[], backgroundObjects: BackgroundObjectEntity[]): CollisionIssue[] {
  const issues: CollisionIssue[] = []
  const activePorts = ports.filter((port) => !port.deleted)

  for (let i = 0; i < lifts.length; i += 1) {
    for (let j = i + 1; j < lifts.length; j += 1) {
      if (intersects(rectFromEntity(lifts[i]), rectFromEntity(lifts[j]), 1)) {
        issues.push({
          id: `lift-collision-${lifts[i].editorId}-${lifts[j].editorId}`,
          sourceId: lifts[i].editorId,
          targetId: lifts[j].editorId,
          severity: 'error',
          message: `Lift 충돌: ${lifts[i].id} ↔ ${lifts[j].id}`,
        })
      }
    }
  }

  for (const port of activePorts) {
    const parentLift = lifts.find((lift) => lift.editorId === port.parentLiftId)
    if (!parentLift) continue
    for (const backgroundObject of backgroundObjects) {
      if (intersects(rectFromEntity(port), rectFromEntity(backgroundObject), 0)) {
        issues.push({
          id: `background-object-collision-${port.editorId}-${backgroundObject.editorId}`,
          sourceId: port.editorId,
          targetId: backgroundObject.editorId,
          severity: 'warning',
          message: `Port가 ${backgroundObject.objectType} 영역과 겹칩니다: ${port.id}`,
        })
      }
    }

    const local = worldToLocal(parentLift, port.position.x, port.position.y)
    const localPadding = 12
    const outsideLiftEnvelope = Math.abs(local.x) > parentLift.width / 2 + localPadding || Math.abs(local.y) > parentLift.depth / 2 + localPadding

    if (outsideLiftEnvelope) {
      issues.push({
        id: `port-detached-${port.editorId}`,
        sourceId: port.editorId,
        targetId: parentLift.editorId,
        severity: 'warning',
        message: `Port가 Lift 면 기준 범위를 벗어났습니다: ${port.id}`,
      })
    }
  }

  for (let i = 0; i < activePorts.length; i += 1) {
    for (let j = i + 1; j < activePorts.length; j += 1) {
      if (intersects(rectFromEntity(activePorts[i]), rectFromEntity(activePorts[j]), 0.5)) {
        issues.push({
          id: `port-collision-${activePorts[i].editorId}-${activePorts[j].editorId}`,
          sourceId: activePorts[i].editorId,
          targetId: activePorts[j].editorId,
          severity: 'error',
          message: `Port 충돌: ${activePorts[i].id} ↔ ${activePorts[j].id}`,
        })
      }
    }
  }

  return issues
}

export function collisionMap(issues: CollisionIssue[]) {
  return issues.reduce<Record<string, CollisionIssue[]>>((acc, issue) => {
    acc[issue.sourceId] = [...(acc[issue.sourceId] ?? []), issue]
    acc[issue.targetId] = [...(acc[issue.targetId] ?? []), issue]
    return acc
  }, {})
}
