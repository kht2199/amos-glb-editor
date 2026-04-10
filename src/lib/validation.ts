import type { LiftEntity, PortEntity, ReadOnlyEntity, ValidationIssue } from '../types'

const ID_PATTERN = /^[A-Za-z0-9_-]+$/

export function validateEntities(lifts: LiftEntity[], ports: PortEntity[], readonlyObjects: ReadOnlyEntity[] = []): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const ids = new Map<string, string>()

  for (const entity of [...lifts, ...ports.filter((port) => !port.deleted)]) {
    if (!entity.id.trim()) {
      issues.push({
        id: `missing-id-${entity.editorId}`,
        severity: 'error',
        targetId: entity.editorId,
        message: 'ID는 비어 있을 수 없습니다.',
      })
      continue
    }

    if (!ID_PATTERN.test(entity.id)) {
      issues.push({
        id: `invalid-format-${entity.editorId}`,
        severity: 'error',
        targetId: entity.editorId,
        message: 'ID는 영문, 숫자, -, _ 만 사용할 수 있습니다.',
      })
    }

    const existing = ids.get(entity.id)
    if (existing) {
      issues.push({
        id: `duplicate-${entity.id}-${entity.editorId}`,
        severity: 'error',
        targetId: entity.editorId,
        message: `중복 ID가 있습니다: ${entity.id}`,
      })
      issues.push({
        id: `duplicate-${entity.id}-${existing}`,
        severity: 'error',
        targetId: existing,
        message: `중복 ID가 있습니다: ${entity.id}`,
      })
    } else {
      ids.set(entity.id, entity.editorId)
    }
  }

  const liftMap = new Map(lifts.map((lift) => [lift.editorId, lift]))
  const readonlyMap = new Map(readonlyObjects.map((item) => [item.editorId, item]))
  const occupied = new Map<string, string>()

  for (const port of ports.filter((item) => !item.deleted)) {
    const parentLift = port.parentLiftId ? liftMap.get(port.parentLiftId) : undefined
    if (port.domainParentType === 'Lift') {
      if (!port.parentLiftId || !parentLift) {
        issues.push({
          id: `missing-parent-${port.editorId}`,
          severity: 'error',
          targetId: port.editorId,
          message: '소속 Lift를 찾을 수 없습니다.',
        })
        continue
      }
    } else {
      if (!port.domainParentId.trim()) {
        issues.push({
          id: `missing-domain-parent-${port.editorId}`,
          severity: 'error',
          targetId: port.editorId,
          message: '도메인 상위 객체 ID가 필요합니다.',
        })
      }

      const readonlyParent = readonlyMap.get(port.domainParentId)
      if (!readonlyParent || readonlyParent.objectType !== port.domainParentType) {
        issues.push({
          id: `invalid-domain-parent-${port.editorId}`,
          severity: 'error',
          targetId: port.editorId,
          message: `${port.domainParentType} 상위 객체를 찾을 수 없습니다.`,
        })
      }
    }

    if (parentLift && (port.slot < 1 || port.slot > parentLift.slotsPerFace)) {
      issues.push({
        id: `slot-range-${port.editorId}`,
        severity: 'error',
        targetId: port.editorId,
        message: `Slot은 1에서 ${parentLift.slotsPerFace} 사이여야 합니다.`,
      })
    }

    const key = `${port.domainParentType}:${port.domainParentId}:${port.face}:${port.slot}`
    const existing = occupied.get(key)
    if (existing) {
      issues.push({
        id: `slot-occupied-${port.editorId}`,
        severity: 'error',
        targetId: port.editorId,
        message: '이미 사용 중인 슬롯입니다.',
      })
      issues.push({
        id: `slot-occupied-${existing}`,
        severity: 'error',
        targetId: existing,
        message: '이미 사용 중인 슬롯입니다.',
      })
    } else {
      occupied.set(key, port.editorId)
    }
  }

  for (const lift of lifts) {
    if (lift.animation.minZ >= lift.animation.maxZ) {
      issues.push({
        id: `animation-range-${lift.editorId}`,
        severity: 'error',
        targetId: lift.editorId,
        message: 'Animation Min Z는 Max Z보다 작아야 합니다.',
      })
    }
  }

  return dedupeIssues(issues)
}

function dedupeIssues(issues: ValidationIssue[]) {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.targetId}:${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
