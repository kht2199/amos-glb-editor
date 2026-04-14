import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { InspectorPanel } from './InspectorPanel'
import { useEditorStore } from '../store/editor-store'

beforeEach(() => {
  useEditorStore.getState().openDemoScene()
})

describe('InspectorPanel', () => {
  it('keeps a stable mobile viewport height when selection details appear', () => {
    const { container, rerender } = render(<InspectorPanel />)

    expect(container.firstElementChild).toHaveClass('min-h-[220px]')
    expect(container.firstElementChild).toHaveClass('max-h-[42svh]')

    const lift = useEditorStore.getState().draftLifts[0]
    useEditorStore.getState().selectObject(lift.editorId)
    rerender(<InspectorPanel />)

    expect(container.firstElementChild).toHaveClass('min-h-[220px]')
    expect(container.firstElementChild).toHaveClass('max-h-[42svh]')
  })

  it('shows object type selector for background-object selection and updates the store', async () => {
    const user = userEvent.setup()
    const state = useEditorStore.getState()
    const stocker = state.draftBackgroundObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    useEditorStore.getState().selectObject(stocker!.editorId)
    render(<InspectorPanel />)

    const typeSelect = screen.getAllByLabelText('Object Type')[0]
    expect(typeSelect).toHaveValue('Stocker')

    await user.selectOptions(typeSelect, 'Lift')

    const next = useEditorStore.getState()
    expect(next.draftLifts.some((item) => item.editorId === stocker!.editorId)).toBe(true)
    expect(next.draftBackgroundObjects.some((item) => item.editorId === stocker!.editorId)).toBe(false)
  })

  it('lets users edit uniform scale for lifts from the inspector', async () => {
    const state = useEditorStore.getState()
    const lift = state.draftLifts[0]

    useEditorStore.getState().selectObject(lift.editorId)
    render(<InspectorPanel />)

    const scaleInput = screen.getAllByLabelText('Scale (%)')[0]
    fireEvent.change(scaleInput, { target: { value: '150' } })

    const next = useEditorStore.getState().draftLifts.find((item) => item.editorId === lift.editorId)
    expect(next?.scale).toEqual({ x: 1.5, y: 1.5, z: 1.5 })
    expect(next?.width).toBeCloseTo(lift.width * 1.5, 5)
  })
})
