import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { useEditorStore } from './store/editor-store'

beforeEach(() => {
  localStorage.clear()
  useEditorStore.setState({
    fileName: null,
    draftLifts: [],
    draftPorts: [],
    draftReadonlyObjects: [],
    appliedLifts: [],
    appliedPorts: [],
    appliedReadonlyObjects: [],
    selectedId: null,
    mode: 'select',
    snapEnabled: true,
    validationIssues: [],
    isValidationOpen: false,
    isPreviewOpen: false,
    saveState: 'saved',
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

describe('App', () => {
  it('shows empty state and loads demo scene', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('GLB 파일을 열어 작업을 시작하세요.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Load Demo Scene' }))
    expect(await screen.findByText('Three.js Object Editor')).toBeInTheDocument()
    expect(screen.getByText(/demo-scene\.glb\s*·\s*DRAFT SYNCED\s*·\s*SAVED/i)).toBeInTheDocument()
  })
})
