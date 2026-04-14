import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { collectMeshProjectionOutlines, computeMeshProjectionOutline } from './topViewProjection'
import type { TopViewFrame } from '../types'

const XY_FRAME: TopViewFrame = {
  originX: 0,
  originY: 0,
  xAxisDirection: 'right',
  yAxisDirection: 'up',
  editPlane: 'xy',
}

function createTriangularPrism() {
  const geometry = new THREE.BufferGeometry()
  const vertices = new Float32Array([
    0, 0, 0,
    20, 0, 0,
    0, 10, 0,
    0, 0, 6,
    20, 0, 6,
    0, 10, 6,
  ])
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  geometry.setIndex([
    0, 1, 2,
    3, 5, 4,
    0, 3, 4,
    0, 4, 1,
    1, 4, 5,
    1, 5, 2,
    2, 5, 3,
    2, 3, 0,
  ])
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial())
  mesh.userData.editorMeta = { id: 'triangular-port' }
  return mesh
}

describe('topViewProjection', () => {
  it('derives a non-rectangular convex hull from the actual mesh vertices', () => {
    const mesh = createTriangularPrism()

    const outline = computeMeshProjectionOutline(mesh, XY_FRAME)

    expect(outline).not.toBeNull()
    expect(outline?.editorId).toBe('triangular-port')
    expect(outline?.points).toHaveLength(3)
    expect(outline?.points).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 0, y: 10 },
    ])
  })

  it('collects outlines for typed scene nodes by editor id', () => {
    const root = new THREE.Group()
    const mesh = createTriangularPrism()
    root.add(mesh)

    const outlines = collectMeshProjectionOutlines(root, XY_FRAME)

    expect(Object.keys(outlines)).toEqual(['triangular-port'])
    expect(outlines['triangular-port']?.points).toHaveLength(3)
  })
})
