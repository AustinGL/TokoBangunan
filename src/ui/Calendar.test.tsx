import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Calendar } from './Calendar'

const base = {
  awal: '2026-10-04', jumlahBulan: 1 as const, hariIni: '2026-10-04',
  pilihan: { from: null, to: null }, onPilih: vi.fn(),
}
const hari = (nama: string) => screen.getByRole('button', { name: nama })
const sel = (nama: string) => hari(nama).closest('[role="gridcell"]') as HTMLElement

describe('Calendar: layout', () => {
  it('shows the month title and Monday-first weekday headers', () => {
    render(<Calendar {...base} />)
    expect(screen.getByRole('heading', { name: 'Oktober 2026' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'])
  })

  it('shows two months side by side when asked', () => {
    render(<Calendar {...base} jumlahBulan={2} />)
    expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['Oktober 2026', 'November 2026'])
    expect(screen.getAllByRole('grid')).toHaveLength(2)
  })

  it('makes every day of the month a button named by its full date, and none for neighbouring days', () => {
    render(<Calendar {...base} />)
    expect(screen.getAllByRole('button', { name: /\d{1,2} Oktober 2026/ })).toHaveLength(31)
    expect(screen.queryByRole('button', { name: '28 September 2026' })).toBeNull()
    expect(screen.queryByRole('button', { name: '1 November 2026' })).toBeNull()
  })

  it('gives day buttons the 44px touch size', () => {
    render(<Calendar {...base} />)
    expect(hari('10 Oktober 2026')).toHaveClass('h-control', 'w-control')
  })

  it('marks today, and the chosen day as selected', () => {
    render(<Calendar {...base} pilihan={{ from: '2026-10-10', to: '2026-10-10' }} />)
    expect(hari('4 Oktober 2026')).toHaveAttribute('aria-current', 'date')
    expect(hari('5 Oktober 2026')).not.toHaveAttribute('aria-current')
    expect(sel('10 Oktober 2026')).toHaveAttribute('aria-selected', 'true')
    expect(sel('11 Oktober 2026')).toHaveAttribute('aria-selected', 'false')
  })
})

describe('Calendar: weeks shown', () => {
  const barisHari = () => screen.getAllByRole('row').length - 1 // minus the weekday header row

  it('shows only the weeks that hold a day of the month: October 2026 needs five, a card a row shorter', () => {
    render(<Calendar {...base} />)
    expect(barisHari()).toBe(5)
  })

  it('still shows six when the month needs them (August 2026 starts on a Saturday)', () => {
    render(<Calendar {...base} awal="2026-08-15" hariIni="2026-08-15" />)
    expect(barisHari()).toBe(6)
    expect(screen.getAllByRole('button', { name: /\d{1,2} Agustus 2026/ })).toHaveLength(31)
  })

  it('never drops a day of the month, in any month of a year', () => {
    for (let bulan = 1; bulan <= 12; bulan += 1) {
      const key = `2026-${String(bulan).padStart(2, '0')}-15`
      const { unmount } = render(<Calendar {...base} awal={key} hariIni={key} />)
      const hari = new Date(2026, bulan, 0).getDate()
      const tombol = screen.getAllByRole('button').filter(el => el.hasAttribute('data-hari'))
      expect(tombol, key).toHaveLength(hari)
      unmount()
    }
  })
})

describe('Calendar: choosing', () => {
  it('reports the chosen day', async () => {
    const onPilih = vi.fn()
    render(<Calendar {...base} onPilih={onPilih} />)
    await userEvent.setup().click(hari('12 Oktober 2026'))
    expect(onPilih).toHaveBeenCalledWith('2026-10-12')
  })

  it('disables days outside min and max, and ignores clicks on them', async () => {
    const onPilih = vi.fn()
    render(<Calendar {...base} min="2026-10-05" max="2026-10-20" onPilih={onPilih} />)
    expect(hari('4 Oktober 2026')).toBeDisabled()
    expect(hari('21 Oktober 2026')).toBeDisabled()
    expect(hari('10 Oktober 2026')).toBeEnabled()
    await userEvent.setup().click(hari('21 Oktober 2026'))
    expect(onPilih).not.toHaveBeenCalled()
  })
})

describe('Calendar: range band', () => {
  it('tints the days between the ends and rounds the ends', () => {
    render(<Calendar {...base} pilihan={{ from: '2026-10-10', to: '2026-10-14' }} />)
    expect(sel('12 Oktober 2026')).toHaveClass('bg-accent-100')
    expect(sel('10 Oktober 2026')).toHaveClass('rounded-l-full')
    expect(sel('14 Oktober 2026')).toHaveClass('rounded-r-full')
    expect(sel('9 Oktober 2026')).not.toHaveClass('bg-accent-100')
    expect(sel('15 Oktober 2026')).not.toHaveClass('bg-accent-100')
    expect(sel('10 Oktober 2026')).toHaveAttribute('aria-selected', 'true')
    expect(sel('14 Oktober 2026')).toHaveAttribute('aria-selected', 'true')
    // Every day inside a chosen range is selected for assistive tech, not just tinted.
    expect(sel('12 Oktober 2026')).toHaveAttribute('aria-selected', 'true')
    expect(sel('9 Oktober 2026')).toHaveAttribute('aria-selected', 'false')
    expect(sel('15 Oktober 2026')).toHaveAttribute('aria-selected', 'false')
  })

  it('draws no band for a one-day range', () => {
    render(<Calendar {...base} pilihan={{ from: '2026-10-10', to: '2026-10-10' }} />)
    expect(sel('10 Oktober 2026')).not.toHaveClass('bg-accent-100')
  })

  it('previews the band toward the pointer while only the start is chosen', () => {
    render(<Calendar {...base} pilihan={{ from: '2026-10-10', to: null }} pratinjau="2026-10-13" />)
    expect(sel('11 Oktober 2026')).toHaveClass('bg-accent-100')
    expect(sel('14 Oktober 2026')).not.toHaveClass('bg-accent-100')
    expect(sel('10 Oktober 2026')).toHaveAttribute('aria-selected', 'true')
    expect(sel('13 Oktober 2026')).toHaveAttribute('aria-selected', 'false')
  })

  it('previews backward too, when the pointer is before the start', () => {
    render(<Calendar {...base} pilihan={{ from: '2026-10-10', to: null }} pratinjau="2026-10-07" />)
    expect(sel('8 Oktober 2026')).toHaveClass('bg-accent-100')
  })

  it('reports the day under the pointer, and null when it leaves', async () => {
    const onFokusHari = vi.fn()
    const { container } = render(<Calendar {...base} onFokusHari={onFokusHari} />)
    const user = userEvent.setup()
    await user.hover(hari('12 Oktober 2026'))
    expect(onFokusHari).toHaveBeenCalledWith('2026-10-12')
    await user.unhover(container.firstElementChild as HTMLElement)
    expect(onFokusHari).toHaveBeenLastCalledWith(null)
  })
})

describe('Calendar: navigation', () => {
  it('moves by month and by year', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} />)
    await user.click(screen.getByRole('button', { name: 'Bulan berikutnya' }))
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tahun sebelumnya' }))
    expect(screen.getByRole('heading', { name: 'November 2025' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bulan sebelumnya' }))
    await user.click(screen.getByRole('button', { name: 'Bulan sebelumnya' }))
    expect(screen.getByRole('heading', { name: 'September 2025' })).toBeInTheDocument()
  })

  it('wraps December to January across the year', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} awal="2026-12-15" hariIni="2026-12-15" />)
    await user.click(screen.getByRole('button', { name: 'Bulan berikutnya' }))
    expect(screen.getByRole('heading', { name: 'Januari 2027' })).toBeInTheDocument()
  })

  it('disables the buttons at the edge of min and max', () => {
    render(<Calendar {...base} min="2026-10-01" max="2026-10-31" />)
    for (const name of ['Bulan sebelumnya', 'Tahun sebelumnya', 'Bulan berikutnya', 'Tahun berikutnya']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })

  it('two months never show a month past max: the first month clamps back so both fit', () => {
    render(<Calendar {...base} jumlahBulan={2} max="2026-10-31" />)
    expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['September 2026', 'Oktober 2026'])
    expect(screen.getByRole('button', { name: 'Bulan berikutnya' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bulan sebelumnya' })).toBeEnabled()
  })

  it('a year jump past min clamps to the earliest allowed month', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} min="2026-04-10" />)
    await user.click(screen.getByRole('button', { name: 'Tahun sebelumnya' }))
    expect(screen.getByRole('heading', { name: 'April 2026' })).toBeInTheDocument()
  })

  it('opens on min when the starting day is before it', () => {
    render(<Calendar {...base} awal="2026-01-01" min="2026-10-05" />)
    expect(screen.getByRole('heading', { name: 'Oktober 2026' })).toBeInTheDocument()
  })
})

describe('Calendar: keyboard', () => {
  it('puts focus on the starting day, and exactly one day is tabbable', () => {
    render(<Calendar {...base} />)
    expect(hari('4 Oktober 2026')).toHaveFocus()
    const tabbable = screen.getAllByRole('button').filter(b => b.getAttribute('tabindex') === '0' && b.hasAttribute('data-hari'))
    expect(tabbable).toHaveLength(1)
  })

  it('arrows move by day and week', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} />)
    await user.keyboard('{ArrowRight}')
    expect(hari('5 Oktober 2026')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(hari('12 Oktober 2026')).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(hari('11 Oktober 2026')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(hari('4 Oktober 2026')).toHaveFocus()
  })

  it('Home goes to Monday and End to Sunday of the focused week', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} awal="2026-10-14" hariIni="2026-10-14" />)
    await user.keyboard('{Home}')
    expect(hari('12 Oktober 2026')).toHaveFocus()
    await user.keyboard('{End}')
    expect(hari('18 Oktober 2026')).toHaveFocus()
  })

  it('PageDown and PageUp move a month, with Shift a year, and the view follows', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} awal="2026-10-18" hariIni="2026-10-18" />)
    await user.keyboard('{PageDown}')
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    expect(hari('18 November 2026')).toHaveFocus()
    await user.keyboard('{Shift>}{PageUp}{/Shift}')
    expect(screen.getByRole('heading', { name: 'November 2025' })).toBeInTheDocument()
    expect(hari('18 November 2025')).toHaveFocus()
  })

  it('an arrow across the month end turns the page', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} awal="2026-10-31" hariIni="2026-10-31" />)
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    expect(hari('1 November 2026')).toHaveFocus()
  })

  it('does not move focus past max or min', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} min="2026-10-03" max="2026-10-05" />)
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(hari('5 Oktober 2026')).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(hari('3 Oktober 2026')).toHaveFocus()
  })

  it('Enter chooses the focused day', async () => {
    const onPilih = vi.fn()
    const user = userEvent.setup()
    render(<Calendar {...base} onPilih={onPilih} />)
    await user.keyboard('{ArrowRight}{Enter}')
    expect(onPilih).toHaveBeenCalledWith('2026-10-05')
  })

  it('keeps one tabbable day after the month is changed with the buttons', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} />)
    await user.click(screen.getByRole('button', { name: 'Bulan berikutnya' }))
    const tabbable = screen.getAllByRole('button').filter(b => b.getAttribute('tabindex') === '0' && b.hasAttribute('data-hari'))
    expect(tabbable).toHaveLength(1)
    expect(tabbable[0].getAttribute('aria-label')).toMatch(/November 2026/)
    expect(within(screen.getByRole('grid')).getByRole('button', { name: tabbable[0].getAttribute('aria-label')! })).toBe(tabbable[0])
  })

  it('reports the focused day', () => {
    const onFokusHari = vi.fn()
    render(<Calendar {...base} onFokusHari={onFokusHari} />)
    expect(onFokusHari).toHaveBeenCalledWith('2026-10-04')
  })
})

describe('Calendar: staying usable while it is open', () => {
  it('moves focus back to a day when the nav button being pressed becomes disabled at the edge', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} max="2026-11-30" />)
    const berikutnya = screen.getByRole('button', { name: 'Bulan berikutnya' })
    await user.click(berikutnya)

    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    expect(berikutnya).toBeDisabled()
    // Focus left on a disabled button would drop out of the card, and the next Escape would close a host dialog.
    expect(document.activeElement).not.toBe(berikutnya)
    expect(document.activeElement?.hasAttribute('data-hari')).toBe(true)
  })

  it('keeps focus on the nav button after a page turn that leaves it enabled', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} />)
    const berikutnya = screen.getByRole('button', { name: 'Bulan berikutnya' })
    await user.click(berikutnya)
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    // Same element, still focused: pressing it again (Enter or Space) keeps paging.
    expect(screen.getByRole('button', { name: 'Bulan berikutnya' })).toBe(berikutnya)
    expect(berikutnya).toHaveFocus()
  })

  it('applies min and max again when the number of months changes while open', () => {
    const { rerender } = render(<Calendar {...base} max="2026-10-31" />)
    expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['Oktober 2026'])
    rerender(<Calendar {...base} max="2026-10-31" jumlahBulan={2} />)
    expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['September 2026', 'Oktober 2026'])
    expect(screen.getByRole('button', { name: 'Bulan berikutnya' })).toBeDisabled()
  })
})

describe('Calendar: what a screen reader is told', () => {
  it('announces the months on show through one live region that stays mounted and changes its text', async () => {
    const user = userEvent.setup()
    render(<Calendar {...base} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Oktober 2026')
    await user.click(screen.getByRole('button', { name: 'Bulan berikutnya' }))
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('November 2026')
  })

  it('names both months when two are on show, and the headings are not live themselves', () => {
    render(<Calendar {...base} jumlahBulan={2} />)
    expect(screen.getByRole('status')).toHaveTextContent('Oktober 2026 dan November 2026')
    for (const h of screen.getAllByRole('heading')) expect(h).not.toHaveAttribute('aria-live')
  })

  it('a range still waiting for its end does not mark the days it merely previews as selected', () => {
    render(<Calendar {...base} pilihan={{ from: '2026-10-10', to: null }} pratinjau="2026-10-14" />)
    expect(sel('12 Oktober 2026')).toHaveAttribute('aria-selected', 'false')
    expect(sel('10 Oktober 2026')).toHaveAttribute('aria-selected', 'true')
  })
})
