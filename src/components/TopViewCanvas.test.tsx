import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TopViewCanvas } from './TopViewCanvas'
import { useEditorStore } from '../store/editor-store'

beforeEach(() => {
  useEditorStore.getState().openDemoScene()
})

describe('TopViewCanvas', () => {
  it('lets users edit the 2D axis directions and reference coordinates', async () => {
    const user = userEvent.setup()
    render(<TopViewCanvas />)

    expect(screen.getByText('Origin (0, 0) · X+ right · Y+ up')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Reference X'))
    await user.type(screen.getByLabelText('Reference X'), '120')
    await user.clear(screen.getByLabelText('Reference Y'))
    await user.type(screen.getByLabelText('Reference Y'), '35')
    await user.selectOptions(screen.getByLabelText('X Axis Positive'), 'left')
    await user.selectOptions(screen.getByLabelText('Y Axis Positive'), 'down')

    expect(useEditorStore.getState().topViewFrame).toEqual({
      originX: 120,
      originY: 35,
      xAxisDirection: 'left',
      yAxisDirection: 'down',
    })
    expect(screen.getByText('Origin (120, 35) · X+ left · Y+ down')).toBeInTheDocument()
  })
})
