import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { DateRangePicker } from './DateRangePicker'
import { keTanggal } from '../test-utils/pickDate'

const trigger = () => screen.getByRole('button', { name: /Rentang tanggal/ })
const kartu = () => screen.queryByRole('dialog', { name: 'Kalender Rentang tanggal' })
const hari = (nama: string) => screen.getByRole('button', { name: nama })
const sel = (nama: string) => hari(nama).closest('[role="gridcell"]') as HTMLElement

const renderPicker = (props: Partial<Parameters<typeof DateRangePicker>[0]> = {}) =>
  render(<DateRangePicker id="rentang" label="Rentang tanggal" value={{ from: '2026-10-01', to: '2026-10-04' }} onChange={vi.fn()} {...props} />)

const original = window.matchMedia
afterEach(() => { window.matchMedia = original })

describe('DateRangePicker: the field', () => {
  it('shows both ends of the range', () => {
    renderPicker()
    expect(trigger()).toHaveTextContent('1 Okt 2026 → 4 Okt 2026')
  })

  it('shows a placeholder when nothing is chosen', () => {
    renderPicker({ value: null })
    expect(trigger()).toHaveTextContent('Tanggal mulai → Tanggal akhir')
  })
})

describe('DateRangePicker: the end-date hint', () => {
  it('is one live region that is always mounted: empty (and out of the layout) until a start is chosen', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(trigger())
    const petunjuk = screen.getByTestId('petunjuk-akhir')
    expect(petunjuk).toHaveAttribute('role', 'status')
    expect(petunjuk).toBeEmptyDOMElement()
    expect(petunjuk).toHaveClass('sr-only')

    await user.click(hari('9 Oktober 2026'))
    expect(screen.getByTestId('petunjuk-akhir')).toBe(petunjuk)
    expect(petunjuk).toHaveTextContent('Pilih tanggal akhir.')
    expect(petunjuk).not.toHaveClass('sr-only')
  })
})

describe('DateRangePicker: a value that is not a range', () => {
  it('shows the placeholder instead of crashing', () => {
    renderPicker({ value: { from: 'NaN-NaN-NaN', to: '2026-10-04' } })
    expect(trigger()).toHaveTextContent('Tanggal mulai → Tanggal akhir')
  })
})

describe('DateRangePicker: choosing a range', () => {
  it('opens on the start of the current range, two months wide, with the range tinted', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(trigger())

    expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['Oktober 2026', 'November 2026'])
    expect(sel('2 Oktober 2026')).toHaveClass('bg-accent-100')
    expect(sel('5 Oktober 2026')).not.toHaveClass('bg-accent-100')
    expect(screen.queryByText('Pilih tanggal akhir.')).toBeNull()
  })

  it('the first click only sets the start; the second sets the end and closes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ onChange })
    await user.click(trigger())

    await user.click(hari('9 Oktober 2026'))
    expect(onChange).not.toHaveBeenCalled()
    expect(kartu()).toBeInTheDocument()
    expect(screen.getByText('Pilih tanggal akhir.')).toBeInTheDocument()

    await user.click(hari('14 Oktober 2026'))
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-09', to: '2026-10-14' })
    expect(kartu()).toBeNull()
    expect(trigger()).toHaveFocus()
  })

  it('an end before the start swaps them', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ onChange })
    await user.click(trigger())
    await user.click(hari('14 Oktober 2026'))
    await user.click(hari('9 Oktober 2026'))
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-09', to: '2026-10-14' })
  })

  it('the same day twice is a one-day range', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ onChange })
    await user.click(trigger())
    await user.click(hari('9 Oktober 2026'))
    await user.click(hari('9 Oktober 2026'))
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-09', to: '2026-10-09' })
  })

  it('can span months, turning the page between the two clicks', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ onChange })
    await user.click(trigger())
    await user.click(hari('20 Oktober 2026'))
    await user.click(await keTanggal(user, '2027-01-10'))
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-20', to: '2027-01-10' })
  })

  it('previews the band while the pointer moves toward the end', async () => {
    const user = userEvent.setup()
    renderPicker()
    await user.click(trigger())
    await user.click(hari('9 Oktober 2026'))
    await user.hover(hari('13 Oktober 2026'))
    expect(sel('11 Oktober 2026')).toHaveClass('bg-accent-100')
    expect(sel('14 Oktober 2026')).not.toHaveClass('bg-accent-100')
  })

  it('works from the keyboard: open, move, Enter for the start, move, Enter for the end', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ onChange })
    trigger().focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(screen.getByText('Pilih tanggal akhir.')).toBeInTheDocument()
    await user.keyboard('{ArrowRight}{ArrowRight}{Enter}')
    expect(onChange).toHaveBeenCalledWith({ from: '2026-10-08', to: '2026-10-10' })
  })
})

describe('DateRangePicker: abandoning a choice', () => {
  it('Escape after the start drops it: reopening shows the original range and no status line', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderPicker({ onChange })
    await user.click(trigger())
    await user.click(hari('9 Oktober 2026'))
    await user.keyboard('{Escape}')
    expect(kartu()).toBeNull()

    await user.click(trigger())
    expect(screen.queryByText('Pilih tanggal akhir.')).toBeNull()
    expect(sel('2 Oktober 2026')).toHaveClass('bg-accent-100')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('a press outside after the start drops it too', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<div><p>di luar</p><DateRangePicker id="rentang" label="Rentang tanggal" value={{ from: '2026-10-01', to: '2026-10-04' }} onChange={onChange} /></div>)
    await user.click(trigger())
    await user.click(hari('9 Oktober 2026'))
    await user.click(screen.getByText('di luar'))
    await user.click(trigger())
    expect(screen.queryByText('Pilih tanggal akhir.')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('DateRangePicker: limits and size', () => {
  it('cannot choose days after max, and never shows a month past it', async () => {
    const user = userEvent.setup()
    renderPicker({ max: '2026-10-20' })
    await user.click(trigger())
    expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['September 2026', 'Oktober 2026'])
    expect(hari('21 Oktober 2026')).toBeDisabled()
    expect(hari('20 Oktober 2026')).toBeEnabled()
  })

  it('shows one month on a narrow screen', async () => {
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia
    const user = userEvent.setup()
    renderPicker()
    await user.click(trigger())
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    expect(within(screen.getByRole('dialog', { name: 'Kalender Rentang tanggal' })).getByRole('heading', { name: 'Oktober 2026' })).toBeInTheDocument()
  })
})
