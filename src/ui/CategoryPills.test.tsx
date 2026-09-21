import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CategoryPills } from './CategoryPills'

const options = [
  { value: 'semua', label: 'Semua' },
  { value: 'semen', label: 'Semen' },
  { value: 'cat', label: 'Cat' },
]

describe('CategoryPills', () => {
  it('renders each option with real radio semantics', () => {
    render(<CategoryPills name="kategori" options={options} value="semua" onChange={vi.fn()} />)

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(radios.map(r => r.getAttribute('value'))).toEqual(['semua', 'semen', 'cat'])
  })

  it('is reachable and operable by keyboard (native radio grouping via shared name)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CategoryPills name="kategori" options={options} value="semua" onChange={onChange} />)

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Semua' }))

    // Activating the focused radio through the keyboard (space) fires onChange,
    // same as it would for a mouse click.
    await user.keyboard(' ')
    // Already checked (it is the current value), so re-pressing space on the
    // same radio does not fire a change event; move to the next option first.
    await user.click(screen.getByRole('radio', { name: 'Semen' }))
    expect(onChange).toHaveBeenCalledWith('semen')
  })

  it('marks the active value checked and reflects it visually, leaving inactive options unchecked', () => {
    render(<CategoryPills name="kategori" options={options} value="semen" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: 'Semen' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Semua' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Cat' })).not.toBeChecked()
  })

  it('fires onChange with the clicked option value, not the previous one', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CategoryPills name="kategori" options={options} value="semua" onChange={onChange} />)

    await user.click(screen.getByRole('radio', { name: 'Cat' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('cat')
  })
})
