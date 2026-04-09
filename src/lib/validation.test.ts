import { describe, expect, it } from 'vitest'
import { DEFAULT_ANIMATION } from './constants'
import { validateEntities } from './validation'
import type { LiftEntity, PortEntity, ReadOnlyEntity } from '../types'

function lift(overrides: Partial<LiftEntity> = {}): LiftEntity {
  return {
    id: 'lift_a',
    editorId: 'lift_a',
    label: 'Lift A',
    objectType: 'Lift',
    nodeName: 'Lift_A',
    position: { x: 0, y: 0, z: 0 },
    width: 60,
    depth: 30,
    height: 20,
    rotation: 0,
    slotsPerFace: 6,
    animation: { ...DEFAULT_ANIMATION },
    ...overrides,
  }
}

function port(overrides: Partial<PortEntity> = {}): PortEntity {
  return {
    id: 'port_a_01',
    editorId: 'port_a_01',
    label: 'Port A-01',
    objectType: 'Port',
    nodeName: 'Port_A_01',
    parentLiftId: 'lift_a',
    domainParentId: 'lift_a',
    domainParentType: 'Lift',
    semanticRole: 'LIFT_DOCK',
    portType: 'IN',
    level: 'TOP',
    face: 'FRONT',
    slot: 1,
    position: { x: 0, y: 0, z: 20 },
    width: 8,
    depth: 8,
    height: 8,
    created: false,
    ...overrides,
  }
}

function stocker(overrides: Partial<ReadOnlyEntity> = {}): ReadOnlyEntity {
  return {
    id: 'stocker_01',
    editorId: 'stocker_01',
    label: 'Stocker 01',
    objectType: 'Stocker',
    nodeName: 'Stocker_01',
    position: { x: 10, y: 10, z: 0 },
    width: 24,
    depth: 24,
    height: 28,
    readOnly: true,
    ...overrides,
  }
}

describe('validateEntities', () => {
  it('returns no issues for a valid lift/port arrangement', () => {
    const issues = validateEntities([lift()], [port()])
    expect(issues).toEqual([])
  })

  it('detects duplicate ids and occupied slots', () => {
    const issues = validateEntities(
      [lift()],
      [port(), port({ editorId: 'port_a_02', id: 'port_a_01', slot: 1 })],
    )

    expect(issues.some((issue) => issue.message.includes('중복 ID'))).toBe(true)
    expect(issues.some((issue) => issue.message.includes('이미 사용 중인 슬롯'))).toBe(true)
  })

  it('detects invalid animation range', () => {
    const issues = validateEntities([lift({ animation: { ...DEFAULT_ANIMATION, minZ: 10, maxZ: 5 } })], [])
    expect(issues.some((issue) => issue.message.includes('Min Z'))).toBe(true)
  })

  it('allows stocker access ports when domain parent metadata exists', () => {
    const issues = validateEntities([], [port({
      parentLiftId: undefined,
      domainParentId: 'stocker_01',
      domainParentType: 'Stocker',
      semanticRole: 'STOCKER_ACCESS',
    })], [stocker()])

    expect(issues).toEqual([])
  })
})
