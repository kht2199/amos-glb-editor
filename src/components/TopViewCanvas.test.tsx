import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildAppliedScene } from '../lib/glb'
import { collectMeshProjectionOutlines, type MeshProjectionOutline } from '../lib/topViewProjection'
import { TopViewCanvas } from './TopViewCanvas'
import { useEditorStore } from '../store/editor-store'
import type { BackgroundObjectEntity, LiftEntity, PortEntity, TopViewFrame, Vec3 } from '../types'

beforeEach(() => {
  useEditorStore.getState().openDemoScene()
})

type Bounds = { minX: number; maxX: number; minY: number; maxY: number }
type PlaneAxis = 'x' | 'y' | 'z'
type SceneEntity = LiftEntity | PortEntity | BackgroundObjectEntity

const PLANE_AXES = {
  xy: { horizontal: 'x', vertical: 'y' },
  xz: { horizontal: 'x', vertical: 'z' },
  yz: { horizontal: 'y', vertical: 'z' },
} as const satisfies Record<TopViewFrame['editPlane'], { horizontal: PlaneAxis; vertical: PlaneAxis }>

function roundValue(value: number) {
  return Number(value.toFixed(2))
}

function axisDirectionSign(direction: TopViewFrame['xAxisDirection'] | TopViewFrame['yAxisDirection']) {
  return direction === 'right' || direction === 'up' ? 1 : -1
}

function planeAxes(frame: TopViewFrame) {
  return PLANE_AXES[frame.editPlane]
}

function axisSize(entity: SceneEntity, axis: PlaneAxis) {
  if (axis === 'x') return entity.width
  if (axis === 'y') return entity.depth
  return entity.height
}

function projectEntityPoint(frame: TopViewFrame, position: Vec3) {
  const axes = planeAxes(frame)
  return {
    x: roundValue((position[axes.horizontal] - frame.originX) * axisDirectionSign(frame.xAxisDirection)),
    y: roundValue((position[axes.vertical] - frame.originY) * axisDirectionSign(frame.yAxisDirection)),
  }
}

function fromFrameCoordinates(frame: TopViewFrame, x: number, y: number) {
  return {
    x: roundValue(frame.originX + x * axisDirectionSign(frame.xAxisDirection)),
    y: roundValue(frame.originY + y * axisDirectionSign(frame.yAxisDirection)),
  }
}

function applyProjectedPosition(position: Vec3, frame: TopViewFrame, projectedX: number, projectedY: number): Vec3 {
  const world = fromFrameCoordinates(frame, projectedX, projectedY)
  const axes = planeAxes(frame)
  return {
    ...position,
    [axes.horizontal]: world.x,
    [axes.vertical]: world.y,
  }
}

function computeBoundsForTest(
  lifts: LiftEntity[],
  ports: PortEntity[],
  backgroundObjects: BackgroundObjectEntity[],
  frame: TopViewFrame,
  meshOutlines: Record<string, MeshProjectionOutline>,
): Bounds {
  const entities = [...lifts, ...ports.filter((port) => !port.deleted), ...backgroundObjects]
  const axes = planeAxes(frame)
  if (!entities.length) return { minX: -100, maxX: 100, minY: -100, maxY: 100 }
  return entities.reduce<Bounds>((acc, item) => {
    const outline = meshOutlines[item.editorId]
    if (outline) {
      return {
        minX: Math.min(acc.minX, outline.bounds.minX - 20),
        maxX: Math.max(acc.maxX, outline.bounds.maxX + 20),
        minY: Math.min(acc.minY, outline.bounds.minY - 20),
        maxY: Math.max(acc.maxY, outline.bounds.maxY + 20),
      }
    }

    const point = projectEntityPoint(frame, item.position)
    return {
      minX: Math.min(acc.minX, point.x - axisSize(item, axes.horizontal) / 2 - 20),
      maxX: Math.max(acc.maxX, point.x + axisSize(item, axes.horizontal) / 2 + 20),
      minY: Math.min(acc.minY, point.y - axisSize(item, axes.vertical) / 2 - 20),
      maxY: Math.max(acc.maxY, point.y + axisSize(item, axes.vertical) / 2 + 20),
    }
  }, {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  })
}

function getProjectionScale(bounds: Bounds, width: number, height: number) {
  const padding = 40
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const worldWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const worldHeight = Math.max(bounds.maxY - bounds.minY, 1)
  return Math.min(usableWidth / worldWidth, usableHeight / worldHeight)
}

function projectPoint(bounds: Bounds, width: number, height: number, position: Vec3, frame: TopViewFrame) {
  const padding = 40
  const scale = getProjectionScale(bounds, width, height)
  const point = projectEntityPoint(frame, position)
  return {
    x: padding + (point.x - bounds.minX) * scale,
    y: padding + (bounds.maxY - point.y) * scale,
  }
}

function unprojectPoint(bounds: Bounds, width: number, height: number, px: number, py: number, frame: TopViewFrame) {
  const padding = 40
  const scale = getProjectionScale(bounds, width, height)
  const point = {
    x: roundValue((px - padding) / scale + bounds.minX),
    y: roundValue(bounds.maxY - (py - padding) / scale),
  }
  return fromFrameCoordinates(frame, point.x, point.y)
}

describe('TopViewCanvas', () => {
  function mockCanvasRect(canvas: HTMLDivElement) {
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 1000,
        height: 700,
        left: 0,
        top: 0,
        right: 1000,
        bottom: 700,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    })
  }

  it('uses a stable mobile min-height so browser scroll chrome does not resize the editor', () => {
    const { container } = render(<TopViewCanvas />)

    expect(container.firstElementChild).toHaveClass('min-h-[62svh]')
    expect(container.firstElementChild).not.toHaveClass('min-h-[62dvh]')

    const canvas = container.querySelector('[data-testid="top-view-canvas-surface"]')
    expect(canvas).toHaveClass('min-h-[34svh]')
    expect(canvas).not.toHaveClass('min-h-[34dvh]')
  })

  it('puts the canvas before the settings block on mobile so the editor appears earlier in the first viewport', () => {
    const { container } = render(<TopViewCanvas />)

    const canvas = container.querySelector('[data-testid="top-view-canvas-surface"]')
    const settings = container.querySelector('[data-testid="top-view-settings"]')

    expect(canvas).toHaveClass('order-1')
    expect(canvas).toHaveClass('lg:order-2')
    expect(settings).toHaveClass('order-2')
    expect(settings).toHaveClass('lg:order-1')
  })

  it('packs the frame controls into a denser mobile grid so settings do not push the canvas too far down', () => {
    const { container } = render(<TopViewCanvas />)

    const settingsGrid = container.querySelector('[data-testid="top-view-settings-grid"]')

    expect(settingsGrid).toHaveClass('grid-cols-2')
    expect(settingsGrid).toHaveClass('xl:grid-cols-6')
  })

  it('shows locked-axis coordinates as read-only status text in the header instead of an editable input', () => {
    const { container } = render(<TopViewCanvas />)
    const settingsGrid = container.querySelector('[data-testid="top-view-settings-grid"]')

    expect(within(settingsGrid as HTMLElement).queryByLabelText('Z Position')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('top-view-coordinate-status').some((node) => node.textContent === 'No selection')).toBe(true)
  })

  it('renders actual mesh projection polygons in top view instead of fixed type silhouettes', () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]
    const port = state.draftPorts.find((item) => !item.deleted)
    const stocker = state.draftBackgroundObjects.find((item) => item.objectType === 'Stocker')

    expect(lift).toBeTruthy()
    expect(port).toBeTruthy()
    expect(stocker).toBeTruthy()

    render(<TopViewCanvas />)

    expect(document.querySelector(`[data-testid="top-view-mesh-shape-${lift!.editorId}"]`)).toBeInTheDocument()
    expect(document.querySelector(`[data-testid="top-view-mesh-shape-${port!.editorId}"]`)).toBeInTheDocument()
    expect(document.querySelector(`[data-testid="top-view-mesh-shape-${stocker!.editorId}"]`)).toBeInTheDocument()
    expect(document.querySelector(`[data-testid="top-view-lift-shape-${lift!.editorId}"]`)).not.toBeInTheDocument()
  })

  it('shows plane-aware coordinate status for the selected object in the header', () => {
    const state = useEditorStore.getState()
    const selectedLift = state.draftLifts[0]
    state.selectObject(selectedLift.editorId)

    render(<TopViewCanvas />)

    expect(screen.getAllByTestId('top-view-coordinate-status').some((node) => node.textContent === `${selectedLift.id} · XY (${selectedLift.position.x}, ${selectedLift.position.y}) · Z ${selectedLift.position.z}`)).toBe(true)
  })

  it('shows a locked-axis drag handle only in move mode and updates only the locked axis when dragged', async () => {
    const state = useEditorStore.getState()
    const selectedLift = state.draftLifts[0]
    state.selectObject(selectedLift.editorId)

    const { rerender } = render(<TopViewCanvas />)
    expect(screen.queryAllByTestId(`top-view-locked-axis-handle-${selectedLift.editorId}`)).toHaveLength(0)

    act(() => {
      useEditorStore.getState().setMode('move')
    })
    rerender(<TopViewCanvas />)

    const handle = screen.getAllByTestId(`top-view-locked-axis-handle-${selectedLift.editorId}`)[0]
    const before = useEditorStore.getState().draftLifts[0].position

    const canvasSurface = screen.getAllByTestId('top-view-canvas-surface')[0]

    await act(async () => {
      fireEvent.pointerDown(handle, { clientX: 200, clientY: 240, pointerId: 1 })
    })
    rerender(<TopViewCanvas />)

    await act(async () => {
      fireEvent.pointerMove(canvasSurface, { clientX: 200, clientY: 180, pointerId: 1 })
      fireEvent.pointerUp(canvasSurface, { pointerId: 1 })
    })

    const after = useEditorStore.getState().draftLifts[0].position
    expect(after.x).toBe(before.x)
    expect(after.y).toBe(before.y)
    expect(after.z).toBeGreaterThan(before.z)
  })

  it('keeps the pointer grab offset stable while dragging an object in move mode', async () => {
    const state = useEditorStore.getState()
    state.setSnapEnabled(false)
    const selectedObject = state.draftBackgroundObjects[0]
    state.selectObject(selectedObject.editorId)
    state.setMode('move')

    const frame = state.topViewFrame
    const appliedScene = buildAppliedScene({
      pristineScene: state.runtime.pristineScene!,
      lifts: state.draftLifts,
      ports: state.draftPorts,
      backgroundObjects: state.draftBackgroundObjects,
    })
    const meshOutlines = collectMeshProjectionOutlines(appliedScene, frame)
    const bounds = computeBoundsForTest(state.draftLifts, state.draftPorts, state.draftBackgroundObjects, frame, meshOutlines)
    const projectedCenter = projectPoint(bounds, 1000, 700, selectedObject.position, frame)
    const pointerDown = { x: projectedCenter.x - 18, y: projectedCenter.y - 14 }
    const pointerMove = { x: pointerDown.x + 20, y: pointerDown.y + 12 }
    const pointerWorldDown = unprojectPoint(bounds, 1000, 700, pointerDown.x, pointerDown.y, frame)
    const pointerWorldMove = unprojectPoint(bounds, 1000, 700, pointerMove.x, pointerMove.y, frame)
    const entityPoint = projectEntityPoint(frame, selectedObject.position)
    const expectedPosition = applyProjectedPosition(
      selectedObject.position,
      frame,
      roundValue(pointerWorldMove.x + (entityPoint.x - pointerWorldDown.x)),
      roundValue(pointerWorldMove.y + (entityPoint.y - pointerWorldDown.y)),
    )

    const { container } = render(<TopViewCanvas />)
    const canvasSurface = container.querySelector('[data-testid="top-view-canvas-surface"]') as HTMLDivElement
    mockCanvasRect(canvasSurface)
    const objectNode = container.querySelector(`[data-testid="top-view-mesh-shape-${selectedObject.editorId}"]`)?.closest('[role="button"]') as HTMLElement

    await act(async () => {
      fireEvent.pointerDown(objectNode, { clientX: pointerDown.x, clientY: pointerDown.y, pointerId: 11 })
    })

    await act(async () => {
      fireEvent.pointerMove(canvasSurface, { clientX: pointerMove.x, clientY: pointerMove.y, pointerId: 11 })
      fireEvent.pointerUp(canvasSurface, { pointerId: 11 })
    })

    const after = useEditorStore.getState().draftBackgroundObjects.find((item) => item.editorId === selectedObject.editorId)?.position
    expect(after).toBeTruthy()
    expect(after?.x).toBe(expectedPosition.x)
    expect(after?.y).toBe(expectedPosition.y)
    expect(after?.z).toBe(selectedObject.position.z)
  })

  it('renders a clearer locked-axis drag affordance in the fixed top-right position and disables touch scrolling on mobile', () => {
    const state = useEditorStore.getState()
    const selectedLift = state.draftLifts[0]
    state.selectObject(selectedLift.editorId)
    state.setMode('move')

    const { container } = render(<TopViewCanvas />)

    const handle = screen.getAllByTestId(`top-view-locked-axis-handle-${selectedLift.editorId}`)[0]
    expect(within(handle).getByText('Drag')).toBeInTheDocument()
    expect(within(handle).getByText('↑↓')).toBeInTheDocument()
    expect(within(handle).getByText('Adjust Z')).toBeInTheDocument()
    expect(handle).not.toHaveTextContent('+')
    expect(handle).not.toHaveTextContent('-')
    expect(handle).toHaveStyle({ top: '16px', right: '16px', touchAction: 'none' })
    expect(container.querySelector('[data-testid="top-view-canvas-surface"]')).toHaveStyle({ touchAction: 'none' })
  })

  it('lets users edit the 2D axis directions and reference coordinates', async () => {
    const user = userEvent.setup()
    const { container } = render(<TopViewCanvas />)
    const view = within(container)

    expect(view.getByText('Edit plane XY · Origin (0, 0) · X+ right · Y+ up')).toBeInTheDocument()

    await user.selectOptions(view.getByLabelText('Edit Plane'), 'xz')
    await user.clear(view.getByLabelText('Reference X'))
    await user.type(view.getByLabelText('Reference X'), '120')
    await user.clear(view.getByLabelText('Reference Z'))
    await user.type(view.getByLabelText('Reference Z'), '35')
    await user.selectOptions(view.getByLabelText('X Axis Positive'), 'left')
    await user.selectOptions(view.getByLabelText('Z Axis Positive'), 'down')

    expect(useEditorStore.getState().topViewFrame).toEqual({
      originX: 120,
      originY: 35,
      xAxisDirection: 'left',
      yAxisDirection: 'down',
      editPlane: 'xz',
    })
    expect(view.getByText('Edit plane XZ · Origin (120, 35) · X+ left · Z+ down')).toBeInTheDocument()
  })

  it('lets users pan the top-view reference frame by dragging empty canvas space', async () => {
    const { container } = render(<TopViewCanvas />)
    const canvas = container.querySelector('.editor-grid') as HTMLDivElement | null
    const view = within(container)

    expect(canvas).not.toBeNull()
    mockCanvasRect(canvas as HTMLDivElement)

    await act(async () => {
      fireEvent.pointerDown(canvas as HTMLDivElement, { clientX: 500, clientY: 350 })
    })
    await act(async () => {
      fireEvent.pointerMove(canvas as HTMLDivElement, { clientX: 560, clientY: 390 })
    })
    await act(async () => {
      fireEvent.pointerUp(canvas as HTMLDivElement)
    })

    await waitFor(() => {
      expect(useEditorStore.getState().topViewFrame).not.toEqual({
        originX: 0,
        originY: 0,
        xAxisDirection: 'right',
        yAxisDirection: 'up',
        editPlane: 'xy',
      })
    })

    const updatedFrame = useEditorStore.getState().topViewFrame
    expect(updatedFrame.originX).toBeLessThan(0)
    expect(updatedFrame.originY).toBeLessThan(0)
    expect(updatedFrame.xAxisDirection).toBe('right')
    expect(updatedFrame.yAxisDirection).toBe('up')
    expect(view.getByLabelText('Reference X')).toHaveValue(updatedFrame.originX)
    expect(view.getByLabelText('Reference Y')).toHaveValue(updatedFrame.originY)
  })

  it('pans in the opposite direction when the frame axes are reversed', async () => {
    const user = userEvent.setup()
    const { container } = render(<TopViewCanvas />)
    const canvas = container.querySelector('.editor-grid') as HTMLDivElement | null
    const view = within(container)

    expect(canvas).not.toBeNull()
    mockCanvasRect(canvas as HTMLDivElement)

    await user.selectOptions(view.getByLabelText('X Axis Positive'), 'left')
    await user.selectOptions(view.getByLabelText('Y Axis Positive'), 'down')

    await act(async () => {
      fireEvent.pointerDown(canvas as HTMLDivElement, { clientX: 500, clientY: 350 })
    })
    await act(async () => {
      fireEvent.pointerMove(canvas as HTMLDivElement, { clientX: 560, clientY: 390 })
    })
    await act(async () => {
      fireEvent.pointerUp(canvas as HTMLDivElement)
    })

    await waitFor(() => {
      const frame = useEditorStore.getState().topViewFrame
      expect(frame.originX).not.toBe(0)
      expect(frame.originY).not.toBe(0)
    })

    const updatedFrame = useEditorStore.getState().topViewFrame
    expect(updatedFrame.originX).toBeGreaterThan(0)
    expect(updatedFrame.originY).toBeGreaterThan(0)
    expect(updatedFrame.xAxisDirection).toBe('left')
    expect(updatedFrame.yAxisDirection).toBe('down')
    expect(view.getByLabelText('Reference X')).toHaveValue(updatedFrame.originX)
    expect(view.getByLabelText('Reference Y')).toHaveValue(updatedFrame.originY)
  })
})
