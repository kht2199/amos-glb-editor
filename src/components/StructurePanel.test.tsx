import { render, screen } from '@testing-library/react'
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
})