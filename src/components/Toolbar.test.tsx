import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'
import { useEditorStore } from '../store/editor-store'

beforeEach(() => {
  useEditorStore.getState().openDemoScene()
})

describe('Toolbar', () => {
  it('uses a compact two-column mobile action grid instead of one very long horizontal rail', () => {
    render(<Toolbar onOpenFile={vi.fn()} />)

    const actionRail = screen.getByTestId('toolbar-action-rail')

    expect(actionRail).toHaveClass('grid')
    expect(actionRail).toHaveClass('grid-cols-2')
    expect(actionRail).not.toHaveClass('overflow-x-auto')
  })

  it('shows an additional import action once a scene is already loaded', () => {
    render(<Toolbar onOpenFile={vi.fn()} />)

    expect(screen.getAllByRole('button', { name: 'Import GLB' }).length).toBeGreaterThan(0)
  })

  it('calls the import handler when Import GLB is clicked', () => {
    const onImportFile = vi.fn()
    render(<Toolbar onOpenFile={vi.fn()} onImportFile={onImportFile} />)

    screen.getAllByRole('button', { name: 'Import GLB' }).forEach((button) => {
      fireEvent.click(button)
    })

    expect(onImportFile).toHaveBeenCalled()
  })

  it('does not show any removed review-drawer action in the toolbar anymore', () => {
    render(<Toolbar onOpenFile={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /validate/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/review drawer/i)).not.toBeInTheDocument()
  })
})
