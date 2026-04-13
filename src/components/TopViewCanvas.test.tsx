import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TopViewCanvas } from './TopViewCanvas'
import { useEditorStore } from '../store/editor-store'

beforeEach(() => {
  useEditorStore.getState().openDemoScene()
})

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

  it('shows the non-plane axis position and lets users edit it directly when working in XY view', async () => {
    const user = userEvent.setup()
    const state = useEditorStore.getState()
    const selectedLift = state.draftLifts[0]
    state.selectObject(selectedLift.editorId)

    const { container } = render(<TopViewCanvas />)
    const settingsGrid = container.querySelector('[data-testid="top-view-settings-grid"]')
    const zInput = within(settingsGrid as HTMLElement).getByLabelText('Z Position')

    expect(zInput).toHaveValue(selectedLift.position.z)

    await user.clear(zInput)
    await user.type(zInput, '42')

    expect(useEditorStore.getState().draftLifts[0].position.z).toBe(42)
    expect(within(settingsGrid as HTMLElement).getByText('XY plane에서 이동되지 않는 축: Z')).toBeInTheDocument()
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
