import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ValidationDrawer } from './ValidationDrawer'
import { useEditorStore } from '../store/editor-store'

beforeEach(() => {
  useEditorStore.setState({
    isValidationOpen: false,
    validationIssues: [],
    selectedId: null,
  })
})

describe('ValidationDrawer', () => {
  it('uses a mobile fixed overlay that stays out of layout flow while closed', () => {
    const { container } = render(<ValidationDrawer />)

    expect(screen.getByRole('heading', { name: 'Validation Results' })).toBeInTheDocument()

    const drawer = container.querySelector('aside')
    expect(drawer).not.toBeNull()
    expect(drawer).toHaveClass('fixed')
    expect(drawer).toHaveClass('inset-y-0')
    expect(drawer).toHaveClass('right-0')
    expect(drawer).toHaveClass('w-full')
    expect(drawer).toHaveClass('pointer-events-none')
    expect(drawer).toHaveClass('translate-x-full')
    expect(drawer).toHaveClass('lg:absolute')
  })
})
