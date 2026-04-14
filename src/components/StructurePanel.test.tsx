import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { StructurePanel } from './StructurePanel'
import { useEditorStore } from '../store/editor-store'

beforeEach(() => {
  useEditorStore.getState().openDemoScene()
})

describe('StructurePanel', () => {
  it('keeps a taller mobile list viewport so more structure rows stay visible', () => {
    const { container } = render(<StructurePanel />)

    expect(screen.getByText('Structure')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('max-h-[42svh]')
    expect(container.firstElementChild).toHaveClass('min-h-[220px]')
  })

  it('renders lift groups collapsed by default and reveals child ports when expanded', () => {
    render(<StructurePanel />)

    const expandButtons = screen.getAllByRole('button', { name: /Expand lift_a/i })
    expect(expandButtons.length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /port_a_01/i })).not.toBeInTheDocument()

    fireEvent.click(expandButtons[0])

    expect(screen.getByRole('button', { name: /port_a_01/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Collapse lift_a/i }).length).toBeGreaterThan(0)
  })
})
