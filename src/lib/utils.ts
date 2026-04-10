import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Face, LiftEntity, PortEntity, Vec3 } from '../types'

export function cn(...inputs: Array<string | undefined | false | null>) {
  return twMerge(clsx(inputs))
}

export function round(value: number, digits = 2) {
  const power = 10 ** digits
  return Math.round(value * power) / power
}

export function snap(value: number, enabled: boolean, step = 5) {
  if (!enabled) return round(value)
  return round(Math.round(value / step) * step)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function localToWorld(lift: LiftEntity, localX: number, localY: number): Pick<Vec3, 'x' | 'y'> {
  const radians = (lift.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: round(lift.position.x + localX * cos - localY * sin),
    y: round(lift.position.y + localX * sin + localY * cos),
  }
}

export function worldToLocal(lift: LiftEntity, worldX: number, worldY: number): { x: number; y: number } {
  const radians = (-lift.rotation * Math.PI) / 180
  const translatedX = worldX - lift.position.x
  const translatedY = worldY - lift.position.y
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: round(translatedX * cos - translatedY * sin),
    y: round(translatedX * sin + translatedY * cos),
  }
}

export function getFaceLocalPosition(lift: LiftEntity, face: Face, slot: number, slotsPerFace = lift.slotsPerFace) {
  const safeSlot = clamp(slot, 1, slotsPerFace)
  const slotStep = face === 'FRONT' || face === 'BACK' ? lift.width / (slotsPerFace + 1) : lift.depth / (slotsPerFace + 1)
  const offset = face === 'FRONT' || face === 'BACK'
    ? -lift.width / 2 + slotStep * safeSlot
    : -lift.depth / 2 + slotStep * safeSlot

  switch (face) {
    case 'FRONT':
      return { x: offset, y: -lift.depth / 2 - 8 }
    case 'BACK':
      return { x: offset, y: lift.depth / 2 + 8 }
    case 'LEFT':
      return { x: -lift.width / 2 - 8, y: offset }
    case 'RIGHT':
      return { x: lift.width / 2 + 8, y: offset }
  }
}

export function computePortPosition(lift: LiftEntity, face: Face, slot: number, zOffset = 0): Vec3 {
  const local = getFaceLocalPosition(lift, face, slot)
  const world = localToWorld(lift, local.x, local.y)
  return {
    x: world.x,
    y: world.y,
    z: lift.position.z + zOffset,
  }
}

export function inferFaceAndSlot(lift: LiftEntity, port: PortEntity): { face: Face; slot: number } {
  const local = worldToLocal(lift, port.position.x, port.position.y)
  const distances = {
    FRONT: Math.abs(local.y + lift.depth / 2),
    BACK: Math.abs(local.y - lift.depth / 2),
    LEFT: Math.abs(local.x + lift.width / 2),
    RIGHT: Math.abs(local.x - lift.width / 2),
  }
  const face = (Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'FRONT') as Face
  const axisSize = face === 'FRONT' || face === 'BACK' ? lift.width : lift.depth
  const coordinate = face === 'FRONT' || face === 'BACK' ? local.x : local.y
  const ratio = clamp((coordinate + axisSize / 2) / axisSize, 0, 0.9999)
  const slot = clamp(Math.floor(ratio * lift.slotsPerFace) + 1, 1, lift.slotsPerFace)
  return { face, slot }
}

export function findNearestLift(lifts: LiftEntity[], x: number, y: number, threshold = 120) {
  const ranked = lifts
    .map((lift) => ({
      lift,
      distance: Math.hypot(lift.position.x - x, lift.position.y - y),
    }))
    .sort((a, b) => a.distance - b.distance)

  return ranked[0] && ranked[0].distance <= threshold ? ranked[0].lift : ranked[0]?.lift ?? null
}

export function snapLiftToNeighbors(target: LiftEntity, x: number, y: number, others: LiftEntity[], enabled: boolean) {
  let nextX = snap(x, enabled)
  let nextY = snap(y, enabled)
  const threshold = enabled ? 12 : 8

  const targetRect = {
    left: nextX - target.width / 2,
    right: nextX + target.width / 2,
    top: nextY - target.depth / 2,
    bottom: nextY + target.depth / 2,
  }

  for (const other of others) {
    const otherRect = {
      left: other.position.x - other.width / 2,
      right: other.position.x + other.width / 2,
      top: other.position.y - other.depth / 2,
      bottom: other.position.y + other.depth / 2,
    }

    const candidates = [
      { delta: otherRect.left - targetRect.left, axis: 'x' },
      { delta: otherRect.right - targetRect.right, axis: 'x' },
      { delta: otherRect.left - targetRect.right, axis: 'x', offset: -target.width / 2 },
      { delta: otherRect.right - targetRect.left, axis: 'x', offset: target.width / 2 },
      { delta: other.position.x - nextX, axis: 'x' },
      { delta: otherRect.top - targetRect.top, axis: 'y' },
      { delta: otherRect.bottom - targetRect.bottom, axis: 'y' },
      { delta: otherRect.top - targetRect.bottom, axis: 'y', offset: -target.depth / 2 },
      { delta: otherRect.bottom - targetRect.top, axis: 'y', offset: target.depth / 2 },
      { delta: other.position.y - nextY, axis: 'y' },
    ]

    for (const candidate of candidates) {
      if (Math.abs(candidate.delta) <= threshold) {
        if (candidate.axis === 'x') nextX = round(nextX + candidate.delta)
        if (candidate.axis === 'y') nextY = round(nextY + candidate.delta)
      }
    }
  }

  return { x: nextX, y: nextY }
}

export function cubicInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}
