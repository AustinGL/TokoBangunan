import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DatePicker } from './DatePicker'
import { keTanggal } from '../test-utils/pickDate'

const trigger = (nama: string | RegExp = /Tanggal beli/) => screen.getByRole('button', { name: nama })
const kartu = () => screen.queryByRole('dialog', { name: 'Kalender Tanggal beli' })

const renderPicker = (props: Partial<Parameters<typeof DatePicker>[0]> = {}) =>
  render(<DatePicker id="tgl" label="Tanggal beli" value={null} onChange={vi.fn()} {...props} />)

describe('DatePicker: the field', () => {
  it('shows a placeholder until a day is chosen, then the day in short form', () => {
    const { rerender } = renderPicker()
    expect(trigger()).toHaveTextContent('Pilih tanggal')
    rerender(<DatePicker id="tgl" label="Tanggal beli" value="2026-09-18" onChange={vi.fn()} />)
    expect(trigger()).toHaveTextContent('18 Sep 2026')
  })

  it('is named by its label and its value, and reachable by label', () => {
    renderPicker({ value: '2026-09-18' })
    expect(screen.getByRole('button', { name: 'Tanggal beli 18 Sep 2026' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tanggal beli')).toBe(trigger())
  })

  it('marks a required field, and shows an error with aria-invalid', () => {
    renderPicker({ required: true, error: 'Tanggal beli tidak boleh di masa depan.' })
    expect(document.querySelector('label[for="tgl"]')).toHaveClass('req')
    expect(screen.getByText('Tanggal beli tidak boleh di masa depan.')).toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-invalid', 'true')
  })

  it('field variant is a full-width 44px control; pill variant is a pill with an sr-only label', () => {
    const { unmount } = renderPicker()
    expect(trigger()).toHaveClass('h-control', 'w-full', 'rounded-field')
    unmount()
    renderPicker({ variant: 'pill', hideLabel: true })
    expect(trigger()).toHaveClass('h-control', 'rounded-pill')
    expect(document.getElementById('tgl-label')).toHaveClass('sr-only')
  })

  it('does not open when disabled', async () => {
    renderPicker({ disabled: true })
    await userEvent.setup().click(trigger())
    expect(kartu()).toBeNull()
  })
})

describe('DatePicker: opening and closing', () => {
  it('opens a calendar card on the chosen day month, with the trigger reporting it', async () => {
    const user = userEvent.setup()
    renderPicker({ value: '2026-09-18' })
    await user.click(trigger())

    expect(kartu()).toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    expect(within(kartu()!).getByRole('heading', { name: 'September 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '18 September 2026' }).closest('[role="gridcell"]')).toHaveAttribute('aria-selected', 'true')
  })

  it('choosing a day reports it, closes the card and returns focus to the field', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ value: '2026-09-18', onChange })
    await user.click(trigger())
    await user.click(screen.getByRole('button', { name: '22 September 2026' }))

    expect(onChange).toHaveBeenCalledWith('2026-09-22')
    expect(kartu()).toBeNull()
    expect(trigger()).toHaveFocus()
  })

  it('reaches a day in another month by turning the page', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ value: '2026-09-18', onChange })
    await user.click(trigger())
    await user.click(await keTanggal(user, '2027-02-03'))
    expect(onChange).toHaveBeenCalledWith('2027-02-03')
  })

  it('Escape closes only the card: the key does not reach a parent (a host dialog)', async () => {
    const onKeyDown = vi.fn()
    const user = userEvent.setup()
    render(
      <div onKeyDown={onKeyDown}>
        <DatePicker id="tgl" label="Tanggal beli" value="2026-09-18" onChange={vi.fn()} />
      </div>,
    )
    await user.click(trigger())
    onKeyDown.mockClear()
    await user.keyboard('{Escape}')

    expect(kartu()).toBeNull()
    expect(onKeyDown).not.toHaveBeenCalled()
    expect(trigger()).toHaveFocus()
  })

  it('a press outside closes the card without choosing anything', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<div><p>di luar</p><DatePicker id="tgl" label="Tanggal beli" value="2026-09-18" onChange={onChange} /></div>)
    await user.click(trigger())
    await user.click(screen.getByText('di luar'))
    expect(kartu()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Tab out of the card closes it', async () => {
    const user = userEvent.setup()
    render(<div><DatePicker id="tgl" label="Tanggal beli" value="2026-09-18" onChange={vi.fn()} /><button>sesudahnya</button></div>)
    await user.click(trigger())
    for (let i = 0; i < 8 && kartu(); i += 1) await user.tab()
    expect(kartu()).toBeNull()
  })

  it('a second click on the field closes the card', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(trigger())
    await user.click(trigger())
    expect(kartu()).toBeNull()
  })

  it('opens from the keyboard and chooses with Enter', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ value: '2026-09-18', onChange })
    trigger().focus()
    await user.keyboard('{Enter}')
    expect(kartu()).toBeInTheDocument()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(onChange).toHaveBeenCalledWith('2026-09-19')
  })
})

describe('DatePicker: staying in view', () => {
  it('scrolls the card into view when it opens, so one taller than the room around the field is not left cut off', async () => {
    const scrollIntoView = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoView
    try {
      const user = userEvent.setup()
      renderPicker({ value: '2026-09-18' })
      expect(scrollIntoView).not.toHaveBeenCalled()
      await user.click(trigger())
      expect(scrollIntoView).toHaveBeenCalledTimes(1)
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
      expect(scrollIntoView.mock.contexts[0]).toBe(kartu())
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })
})

describe('DatePicker: a value that is not a date', () => {
  it('shows the placeholder instead of crashing, and opens on today', async () => {
    renderPicker({ value: 'NaN-NaN-NaN' })
    expect(trigger()).toHaveTextContent('Pilih tanggal')
    await userEvent.setup().click(trigger())
    expect(kartu()).toBeInTheDocument()
  })
})

describe('DatePicker: limits', () => {
  it('cannot choose days after max or before min', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ value: '2026-09-18', min: '2026-09-10', max: '2026-09-20', onChange })
    await user.click(trigger())
    expect(screen.getByRole('button', { name: '21 September 2026' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '9 September 2026' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '21 September 2026' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Bulan berikutnya' })).toBeDisabled()
  })
})
