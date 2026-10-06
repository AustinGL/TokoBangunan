import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { value: 'semua', label: 'Semua' },
  { value: 'hari-ini', label: 'Hari ini' },
  { value: 'kemarin', label: 'Kemarin' },
]

describe('SegmentedControl', () => {
  it('is a labelled group of toggle buttons, with only the chosen one pressed', () => {
    render(<SegmentedControl aria-label="Pilih hari" options={OPTIONS} value="hari-ini" onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Pilih hari' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hari ini' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Semua' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Kemarin' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the segment that was pressed', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl aria-label="Pilih hari" options={OPTIONS} value="semua" onChange={onChange} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Kemarin' }))
    expect(onChange).toHaveBeenCalledWith('kemarin')
  })

  it('presses nothing when the value matches no segment (a hand-picked date)', () => {
    render(<SegmentedControl aria-label="Pilih hari" options={OPTIONS} value={null} onChange={vi.fn()} />)
    for (const label of ['Semua', 'Hari ini', 'Kemarin']) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('keeps every segment at the shared control height', () => {
    render(<SegmentedControl aria-label="Pilih hari" options={OPTIONS} value="semua" onChange={vi.fn()} />)
    for (const label of ['Semua', 'Hari ini', 'Kemarin']) {
      expect(screen.getByRole('button', { name: label })).toHaveClass('h-control')
    }
  })

  it('hides its sliding thumb from assistive tech', () => {
    const { container } = render(<SegmentedControl aria-label="Pilih hari" options={OPTIONS} value="semua" onChange={vi.fn()} />)
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})
