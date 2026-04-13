import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useEditorStore } from './store/editor-store'

vi.mock('./components/PreviewPanel', () => ({
  PreviewPanel: () => <div data-testid="preview-panel-mock" />,
}))

vi.mock('./components/PreviewOverlay', () => ({
  PreviewOverlay: () => null,
}))

beforeEach(() => {
  useEditorStore.setState({
    fileName: null,
    draftLifts: [],
    draftPorts: [],
    draftBackgroundObjects: [],
    appliedLifts: [],
    appliedPorts: [],
    appliedBackgroundObjects: [],
    selectedId: null,
    mode: 'select',
    snapEnabled: true,
    validationIssues: [],
    isValidationOpen: false,
    isPreviewOpen: false,
    statusMessage: 'No file loaded',
    exportFeedback: { status: 'idle' },
    runtime: { workingScene: null, pristineScene: null, animations: [] },
    collisionIssues: [],
    collisionIndex: {},
    history: [],
    future: [],
    canUndo: false,
    canRedo: false,
    hasPendingChanges: false,
  })
})

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('shows empty state and loads demo scene', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('GLB 파일을 열어 작업을 시작하세요.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load Demo Scene' }))
    expect(await screen.findByText('Three.js Object Editor')).toBeInTheDocument()
    expect(screen.getByText(/demo-scene\.glb\s*·\s*DRAFT SYNCED/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument()
  })

  it('does not trigger duplicate shortcut while editing an input', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Load Demo Scene' }))
    const liftButtons = await screen.findAllByRole('button', { name: /lift_a/i })
    await user.click(liftButtons[0])

    const idInput = screen.getByLabelText('ID')
    const beforeCount = useEditorStore.getState().draftLifts.length

    await user.click(idInput)
    await user.keyboard('d')

    expect(useEditorStore.getState().draftLifts).toHaveLength(beforeCount)
  })
})
