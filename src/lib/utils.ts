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

export function cubicInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
}
