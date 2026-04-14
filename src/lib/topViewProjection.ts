import * as THREE from 'three'
import type { TopViewEditPlane, TopViewFrame } from '../types'
import { round } from './utils'

interface ProjectionPoint {
  x: number
  y: number
}

interface ProjectionBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface MeshProjectionOutline {
  editorId: string
  points: ProjectionPoint[]
  bounds: ProjectionBounds
}

type PlaneAxis = 'x' | 'y' | 'z'

const PLANE_AXES: Record<TopViewEditPlane, { horizontal: PlaneAxis; vertical: PlaneAxis }> = {
  xy: { horizontal: 'x', vertical: 'y' },
  xz: { horizontal: 'x', vertical: 'z' },
  yz: { horizontal: 'y', vertical: 'z' },
}

function axisDirectionSign(direction: TopViewFrame['xAxisDirection'] | TopViewFrame['yAxisDirection']) {
  return direction === 'right' || direction === 'up' ? 1 : -1
}

function planeAxes(frame: TopViewFrame) {
  return PLANE_AXES[frame.editPlane]
}

function toFrameCoordinates(frame: TopViewFrame, x: number, y: number) {
  return {
    x: round((x - frame.originX) * axisDirectionSign(frame.xAxisDirection), 4),
    y: round((y - frame.originY) * axisDirectionSign(frame.yAxisDirection), 4),
  }
}

function projectVectorToPlane(frame: TopViewFrame, vector: THREE.Vector3) {
  const axes = planeAxes(frame)
  return toFrameCoordinates(frame, vector[axes.horizontal], vector[axes.vertical])
}

function uniquePoints(points: ProjectionPoint[]) {
  const seen = new Set<string>()
  return points.filter((point) => {
    const key = `${round(point.x, 4)}:${round(point.y, 4)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cross(o: ProjectionPoint, a: ProjectionPoint, b: ProjectionPoint) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

function convexHull(points: ProjectionPoint[]) {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  if (sorted.length <= 1) return sorted

  const lower: ProjectionPoint[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper: ProjectionPoint[] = []
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

function pointsBounds(points: ProjectionPoint[]): ProjectionBounds {
  return points.reduce<ProjectionBounds>((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  })
}

function projectedMeshVertices(object: THREE.Object3D, frame: TopViewFrame) {
  const points: ProjectionPoint[] = []
  object.updateWorldMatrix(true, true)
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const geometry = child.geometry
    const position = geometry.getAttribute('position')
    if (!position) return
    const vertex = new THREE.Vector3()
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index)
      child.localToWorld(vertex)
      points.push(projectVectorToPlane(frame, vertex))
    }
  })
  return uniquePoints(points)
}

function projectedBoundsCorners(object: THREE.Object3D, frame: TopViewFrame) {
  object.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(object)
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return []

  const corners = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ]

  return uniquePoints(corners.map((corner) => projectVectorToPlane(frame, corner)))
}

export function computeMeshProjectionOutline(object: THREE.Object3D, frame: TopViewFrame): MeshProjectionOutline | null {
  const editorId = object.userData?.editorMeta?.id
  if (!editorId) return null

  const points = projectedMeshVertices(object, frame)
  const source = points.length >= 3 ? points : projectedBoundsCorners(object, frame)
  if (source.length < 3) return null

  const hull = convexHull(source)
  if (hull.length < 3) return null

  return {
    editorId: String(editorId),
    points: hull,
    bounds: pointsBounds(hull),
  }
}

export function collectMeshProjectionOutlines(root: THREE.Object3D, frame: TopViewFrame) {
  const outlines: Record<string, MeshProjectionOutline> = {}
  root.updateWorldMatrix(true, true)
  root.traverse((child) => {
    const editorId = child.userData?.editorMeta?.id
    if (!editorId) return
    const outline = computeMeshProjectionOutline(child, frame)
    if (outline) outlines[String(editorId)] = outline
  })
  return outlines
}
