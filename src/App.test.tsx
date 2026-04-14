import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { DEFAULT_OBJECT_TYPE_DEFINITIONS, useEditorStore } from './store/editor-store'

vi.mock('./components/PreviewPanel', () => ({
  PreviewPanel: () => <div data-testid="preview-panel-mock" />,
}))

vi.mock('./components/PreviewOverlay', () => ({
  PreviewOverlay: () => null,
}))

beforeEach(() => {
  useEditorStore.setState({
    fileName: null,
    objectTypeDefinitions: DEFAULT_OBJECT_TYPE_DEFINITIONS.map((item) => ({ ...item })),
    draftLifts: [],
    draftPorts: [],
    draftBackgroundObjects: [],
    appliedLifts: [],
    appliedPorts: [],
    appliedBackgroundObjects: [],
    selectedId: null,
    mode: 'select',
    topViewFrame: { originX: 0, originY: 0, xAxisDirection: 'right', yAxisDirection: 'up', editPlane: 'xy' },
    snapEnabled: true,
    validationIssues: [],
    isValidationOpen: false,
    isPreviewOpen: false,
    statusMessage: 'No file loaded',
    exportFeedback: { status: 'idle' },
    runtime: { pristineScene: null, animations: [] },
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

  it('lets the user add a type from the screen and uses it in object type selectors', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Load Demo Scene' }))
    await user.click(screen.getByRole('button', { name: 'Type Settings' }))
    await user.type(screen.getByLabelText('Type Name'), 'Tool')
    await user.selectOptions(screen.getByLabelText('Type Behavior'), 'background')
    await user.click(screen.getByRole('button', { name: 'Add Type' }))

    const stockerButton = screen.getAllByRole('button', { name: /stocker_01/i })[0]
    await user.click(stockerButton)

    const typeSelect = screen.getByLabelText('Object Type')
    expect(screen.getAllByRole('button', { name: 'Tool' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('option', { name: 'Tool' })).toBeInTheDocument()
    expect(typeSelect).toHaveValue('Stocker')
  })

  it('renders the plane editor before the structure list so mobile users see the editor first', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Load Demo Scene' }))

    const layoutHeadings = screen.getAllByRole('heading', { level: 2 })
    const planeEditorIndex = layoutHeadings.findIndex((heading) => heading.textContent === 'GLB Plane Editor')
    const structureIndex = layoutHeadings.findIndex((heading) => heading.textContent === 'Structure')

    expect(planeEditorIndex).toBeGreaterThanOrEqual(0)
    expect(structureIndex).toBeGreaterThanOrEqual(0)
    expect(planeEditorIndex).toBeLessThan(structureIndex)
  })

  it('imports an additional GLB when a file is dropped onto an already loaded editor', () => {
    const importFile = vi.fn().mockResolvedValue(undefined)
    useEditorStore.getState().openDemoScene()
    useEditorStore.setState({ importFile })
    render(<App />)

    const file = new File(['glb'], 'extra.glb', { type: 'model/gltf-binary' })
    fireEvent.drop(screen.getByTestId('app-shell'), {
      dataTransfer: {
        files: [file],
      },
    })

    expect(importFile).toHaveBeenCalledWith(file)
  })
})
