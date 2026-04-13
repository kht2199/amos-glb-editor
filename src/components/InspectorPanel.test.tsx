import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { InspectorPanel } from './InspectorPanel'
import { useEditorStore } from '../store/editor-store'

beforeEach(() => {
  localStorage.clear()
  useEditorStore.getState().openDemoScene()
})

describe('InspectorPanel', () => {
  it('shows object type selector for background-object selection and updates the store', async () => {
    const user = userEvent.setup()
    const state = useEditorStore.getState()
    const stocker = state.draftBackgroundObjects.find((item) => item.id === 'stocker_01')

    expect(stocker).toBeTruthy()
    useEditorStore.getState().selectObject(stocker!.editorId)
    render(<InspectorPanel />)

    const typeSelect = screen.getByLabelText('Object Type')
    expect(typeSelect).toHaveValue('Stocker')

    await user.selectOptions(typeSelect, 'Lift')

    const next = useEditorStore.getState()
    expect(next.draftLifts.some((item) => item.editorId === stocker!.editorId)).toBe(true)
    expect(next.draftBackgroundObjects.some((item) => item.editorId === stocker!.editorId)).toBe(false)
  })
})
