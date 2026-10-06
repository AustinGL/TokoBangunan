import type { ComponentProps } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ListboxPanel } from './ListboxPanel'
import { optionId, type ListboxRow } from './listbox'
import { DEFAULT_PLACEMENT } from './panelPlacement'

const rows: ListboxRow[] = [
  { value: 'u1', label: '50 kg', hint: 'Stok 40 · Rp 65.000' },
  { value: 'u2', label: '25 kg' },
]

function renderPanel(over: Partial<ComponentProps<typeof ListboxPanel>> = {}) {
  const onPick = vi.fn()
  render(
    <div className="relative">
      <ListboxPanel
        id="lb" rows={rows} activeIndex={-1} selectedValue={null}
        emptyText="Tidak ada hasil." placement={DEFAULT_PLACEMENT} onPick={onPick} {...over}
      />
    </div>,
  )
  return { onPick }
}

describe('ListboxPanel', () => {
  it('names each option by its label alone and exposes the hint as its description', () => {
    renderPanel()
    const option = screen.getByRole('option', { name: '50 kg' })
    expect(option).toHaveAccessibleDescription('Stok 40 · Rp 65.000')
    expect(screen.getByRole('option', { name: '25 kg' })).not.toHaveAccessibleDescription()
  })

  it('marks only the chosen value as aria-selected, and gives every row a stable id', () => {
    renderPanel({ selectedValue: 'u2' })
    expect(screen.getByRole('option', { name: '25 kg' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '50 kg' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('option', { name: '25 kg' })).toHaveAttribute('id', optionId('lb', 1))
  })

  it('flags the keyboard-highlighted row separately from the chosen one', () => {
    renderPanel({ activeIndex: 0, selectedValue: 'u2' })
    expect(screen.getByRole('option', { name: '50 kg' })).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('option', { name: '25 kg' })).toHaveAttribute('data-active', 'false')
  })

  it('picks a row on mouse down and keeps focus where it was (default prevented)', () => {
    const { onPick } = renderPanel()
    const notCancelled = fireEvent.mouseDown(screen.getByRole('option', { name: '25 kg' }))
    expect(notCancelled).toBe(false)
    expect(onPick).toHaveBeenCalledWith(rows[1])
  })

  it('does not pick a disabled row', () => {
    const { onPick } = renderPanel({ rows: [{ value: 'x', label: 'Habis', disabled: true }] })
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Habis' }))
    expect(onPick).not.toHaveBeenCalled()
    expect(screen.getByRole('option', { name: 'Habis' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders a create row as an action and passes its kind through on pick', () => {
    const create: ListboxRow = { value: '__create__', label: 'Tambah "UD Baru"', kind: 'create' }
    const { onPick } = renderPanel({ rows: [...rows, create], highlight: 'ud' })
    // The create label is never split by the highlight.
    fireEvent.mouseDown(screen.getByText('Tambah "UD Baru"'))
    expect(onPick).toHaveBeenCalledWith(create)
    expect(screen.getByRole('option', { name: 'Tambah "UD Baru"' })).toHaveAttribute('aria-selected', 'false')
  })

  it('shows the empty text and no options when there are no rows', () => {
    renderPanel({ rows: [] })
    expect(screen.getByText('Tidak ada hasil.')).toBeInTheDocument()
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('emphasises the typed text inside a matching label without changing the accessible name', () => {
    renderPanel({ highlight: 'kg' })
    const option = screen.getByRole('option', { name: '50 kg' })
    expect(within(option).getByText('kg', { selector: 'strong' })).toBeInTheDocument()
  })

  it('opens upward with the given max height when the placement says so', () => {
    renderPanel({ placement: { side: 'up', maxHeight: 200 } })
    const list = screen.getByRole('listbox')
    expect(list).toHaveClass('bottom-full')
    expect(list).toHaveStyle({ maxHeight: '200px' })
  })

  it('opens with the grow-in animation and plays the exit one while closing', () => {
    const { unmount } = render(<div className="relative"><ListboxPanel id="lb" rows={rows} activeIndex={-1} selectedValue={null} emptyText="x" placement={DEFAULT_PLACEMENT} onPick={vi.fn()} /></div>)
    expect(screen.getByRole('listbox')).toHaveClass('listbox-in')
    unmount()

    render(<div className="relative"><ListboxPanel id="lb" rows={rows} activeIndex={-1} selectedValue={null} emptyText="x" placement={DEFAULT_PLACEMENT} closing onPick={vi.fn()} /></div>)
    expect(document.querySelector('ul')).toHaveClass('listbox-out')
  })

  it('is a ghost while closing: no listbox role, hidden from assistive tech and inert', () => {
    renderPanel({ closing: true })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.queryByRole('option')).toBeNull()
    const ghost = document.querySelector('ul')!
    expect(ghost).toHaveAttribute('aria-hidden', 'true')
    expect(ghost).not.toHaveAttribute('id')
    expect(ghost).toHaveAttribute('inert')
  })
})
