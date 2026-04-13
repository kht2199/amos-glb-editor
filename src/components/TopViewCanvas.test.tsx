import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  it('lets users edit the 2D axis directions and reference coordinates', async () => {
    const user = userEvent.setup()
    render(<TopViewCanvas />)

    expect(screen.getByText('Origin (0, 0) · X+ right · Y+ up')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Reference X'))
    await user.type(screen.getByLabelText('Reference X'), '120')
    await user.clear(screen.getByLabelText('Reference Y'))
    await user.type(screen.getByLabelText('Reference Y'), '35')
    await user.selectOptions(screen.getByLabelText('X Axis Positive'), 'left')
    await user.selectOptions(screen.getByLabelText('Y Axis Positive'), 'down')

    expect(useEditorStore.getState().topViewFrame).toEqual({
      originX: 120,
      originY: 35,
      xAxisDirection: 'left',
      yAxisDirection: 'down',
    })
    expect(screen.getByText('Origin (120, 35) · X+ left · Y+ down')).toBeInTheDocument()
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
