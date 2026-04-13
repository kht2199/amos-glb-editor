import { render, screen } from '@testing-library/react'
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
})
