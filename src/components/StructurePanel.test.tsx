import { fireEvent, render, screen, within } from '@testing-library/react'
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
    expect(container.firstElementChild).toHaveClass('max-h-[48svh]')
    expect(container.firstElementChild).toHaveClass('min-h-[260px]')
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

  it('renders expanded child rows inside a nested container with clear spacing on mobile', () => {
    render(<StructurePanel />)

    fireEvent.click(screen.getAllByRole('button', { name: /Expand lift_a/i })[0])

    const nestedContainer = screen.getAllByTestId('structure-children-lift_a')[0]
    expect(nestedContainer).toHaveClass('ml-7')
    expect(nestedContainer).toHaveClass('space-y-2')
    expect(nestedContainer).toHaveClass('border-l')
    expect(within(nestedContainer).getByRole('button', { name: /port_a_01/i })).toHaveClass('min-h-10')
  })

  it('keeps quick actions below the scrollable list so selecting an item does not insert a panel above expanded rows', () => {
    const { container } = render(<StructurePanel />)

    fireEvent.click(screen.getAllByRole('button', { name: /Expand lift_a/i })[0])
    fireEvent.click(screen.getAllByRole('button', { name: /port_a_01/i })[0])

    const aside = container.firstElementChild as HTMLElement
    const scrollArea = aside.children[1] as HTMLElement
    const quickActions = aside.children[2] as HTMLElement
    expect(scrollArea).toHaveClass('min-h-0')
    expect(quickActions).toHaveTextContent('Quick actions')
    expect(quickActions).toHaveClass('border-t')

    fireEvent.click(screen.getAllByRole('button', { name: /duplicate selected object/i })[0])

    const stateAfterDuplicate = useEditorStore.getState()
    expect(stateAfterDuplicate.draftPorts.filter((item) => !item.deleted)).toHaveLength(5)

    const duplicatedPort = stateAfterDuplicate.draftPorts.find((item) => item.editorId === stateAfterDuplicate.selectedId)
    expect(duplicatedPort).toBeTruthy()
    expect(duplicatedPort?.id).toMatch(/copy/i)

    fireEvent.change(screen.getAllByLabelText('Quick X')[0], { target: { value: '123' } })
    fireEvent.change(screen.getAllByLabelText('Quick Y')[0], { target: { value: '-45' } })
    fireEvent.change(screen.getAllByLabelText('Quick Z')[0], { target: { value: '77' } })

    const movedPort = useEditorStore.getState().draftPorts.find((item) => item.editorId === useEditorStore.getState().selectedId)
    expect(movedPort?.position).toMatchObject({ x: 123, y: -45, z: 77 })
  })

  it('does not reset a quick coordinate to zero while the user is typing a negative value', () => {
    render(<StructurePanel />)

    fireEvent.click(screen.getAllByRole('button', { name: /Expand lift_a/i })[0])
    fireEvent.click(screen.getAllByRole('button', { name: /port_a_01/i })[0])

    const selectedPortBefore = useEditorStore.getState().draftPorts.find((item) => item.editorId === useEditorStore.getState().selectedId)
    expect(selectedPortBefore).toBeTruthy()

    fireEvent.change(screen.getAllByLabelText('Quick Y')[0], { target: { value: '-' } })

    const selectedPortAfterDash = useEditorStore.getState().draftPorts.find((item) => item.editorId === useEditorStore.getState().selectedId)
    expect(selectedPortAfterDash?.position.y).toBe(selectedPortBefore?.position.y)

    fireEvent.change(screen.getAllByLabelText('Quick Y')[0], { target: { value: '-45' } })

    const selectedPortAfterNumber = useEditorStore.getState().draftPorts.find((item) => item.editorId === useEditorStore.getState().selectedId)
    expect(selectedPortAfterNumber?.position.y).toBe(-45)
  })
})
