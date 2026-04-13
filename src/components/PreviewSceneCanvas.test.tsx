import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { useEditorStore } from '../store/editor-store'
import type { BackgroundObjectEntity, LiftEntity, PortEntity } from '../types'

const orbitControlsSpy = vi.hoisted(() => vi.fn())
const sharedCameraState = vi.hoisted(() => ({
  camera: {
    position: { set: vi.fn() },
    lookAt: vi.fn(),
    up: { set: vi.fn() },
  },
}))

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="preview-canvas">{children}</div>,
  useThree: () => ({ camera: sharedCameraState.camera }),
}))

vi.mock('@react-three/drei', async () => {
  const React = await import('react')

  const OrbitControls = React.forwardRef((props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
    orbitControlsSpy(props)
    React.useImperativeHandle(ref, () => ({
      object: { up: new THREE.Vector3() },
      target: new THREE.Vector3(),
      update: vi.fn(),
    }))
    return <div data-testid="orbit-controls" />
  })

  OrbitControls.displayName = 'OrbitControls'

  return {
    Grid: () => <div data-testid="grid" />,
    GizmoHelper: ({ children }: { children: React.ReactNode }) => <div data-testid="gizmo-helper">{children}</div>,
    GizmoViewport: () => <div data-testid="gizmo-viewport" />,
    OrbitControls,
  }
})

vi.mock('../lib/glb', () => ({
  buildAppliedScene: () => new THREE.Group(),
}))

import { PreviewSceneCanvas } from './PreviewSceneCanvas'

type SceneEntity = LiftEntity | PortEntity | BackgroundObjectEntity

function visiblePorts(ports: PortEntity[]) {
  return ports.filter((port) => !port.deleted)
}

function allEntities(lifts: LiftEntity[], ports: PortEntity[], backgroundObjects: BackgroundObjectEntity[]) {
  return [...backgroundObjects, ...lifts, ...visiblePorts(ports)]
}

function entityCenter(entity: SceneEntity) {
  return new THREE.Vector3(
    entity.position.x,
    entity.position.y,
    entity.position.z + entity.height / 2,
  )
}

function computeSceneCenter(entities: SceneEntity[]) {
  const box = new THREE.Box3()
  entities.forEach((entity) => {
    const center = entityCenter(entity)
    const half = new THREE.Vector3(entity.width / 2, entity.depth / 2, entity.height / 2)
    box.expandByPoint(center.clone().sub(half))
    box.expandByPoint(center.clone().add(half))
  })
  return box.getCenter(new THREE.Vector3())
}

beforeEach(() => {
  orbitControlsSpy.mockClear()
  sharedCameraState.camera.position.set.mockClear()
  sharedCameraState.camera.lookAt.mockClear()
  sharedCameraState.camera.up.set.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  useEditorStore.getState().openDemoScene()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PreviewSceneCanvas', () => {
  it('allows a full 360-degree orbit without vertical angle clamps', () => {
    render(<PreviewSceneCanvas />)

    const latestProps = orbitControlsSpy.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined

    expect(latestProps).toMatchObject({
      minDistance: 40,
      maxDistance: 320,
      minPolarAngle: 0,
      maxPolarAngle: Math.PI,
    })
    expect(latestProps?.minAzimuthAngle).toBeUndefined()
    expect(latestProps?.maxAzimuthAngle).toBeUndefined()
  })

  it('shows reset/focus controls and keeps focus disabled when nothing is selected', () => {
    render(<PreviewSceneCanvas />)

    expect(screen.getByRole('button', { name: 'Reset View' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Focus Selection' })).toBeDisabled()
  })

  it('shows a compact XYZ position overlay for the current selection on top of the 3D preview', () => {
    const state = useEditorStore.getState()
    const selectedLift = state.appliedLifts[0]
    state.selectObject(selectedLift.editorId)

    render(<PreviewSceneCanvas />)

    expect(screen.getByText(selectedLift.id)).toBeInTheDocument()
    expect(screen.getByText(`X ${selectedLift.position.x} · Y ${selectedLift.position.y} · Z ${selectedLift.position.z}`)).toBeInTheDocument()
    expect(screen.getByText('2D Plane XY · Free axis Z')).toBeInTheDocument()
  })

  it('focuses the selected object and lets reset return to the whole-scene framing', async () => {
    const user = userEvent.setup()
    const state = useEditorStore.getState()
    const selectedLift = state.appliedLifts[0]
    state.selectObject(selectedLift.editorId)

    render(<PreviewSceneCanvas />)

    const entities = allEntities(state.appliedLifts, state.appliedPorts, state.appliedBackgroundObjects)
    const expectedSceneCenter = computeSceneCenter(entities)
    const expectedSelectionCenter = entityCenter(selectedLift)

    const resetButton = screen.getByRole('button', { name: 'Reset View' })
    const focusButton = screen.getByRole('button', { name: 'Focus Selection' })

    expect(focusButton).toBeEnabled()

    await user.click(focusButton)
    const focusArgs = sharedCameraState.camera.lookAt.mock.calls.at(-1)
    expect(focusArgs).toEqual([
      expectedSelectionCenter.x,
      expectedSelectionCenter.y,
      expectedSelectionCenter.z,
    ])

    await user.click(resetButton)
    const resetArgs = sharedCameraState.camera.lookAt.mock.calls.at(-1)
    expect(resetArgs).toEqual([
      expectedSceneCenter.x,
      expectedSceneCenter.y,
      expectedSceneCenter.z,
    ])
  })
})
