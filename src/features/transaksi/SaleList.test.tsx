import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { recordSale, voidSale, type RecordSaleInput } from '../../data/commands'
import { fixedClock, systemClock } from '../../domain/clock'
import { shortNota } from '../../domain/nota'
import { SaleList } from './SaleList'
import { pilihTanggal } from '../../test-utils/pickDate'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

const semenCart: RecordSaleInput = {
  lines: [
    { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 3000, hargaSatuan: 52000, subtotal: 156000 },
  ],
  metodeBayar: 'tunai',
}

const pasirCart: RecordSaleInput = {
  lines: [
    { itemId: 'pasir', nama: 'Pasir', unit: 'm3', qty: 1000, hargaSatuan: 180000, subtotal: 180000 },
  ],
  metodeBayar: 'tunai',
}

// The open nota repeats the sale's item names, so name queries are scoped to
// the list table: they ask "is this sale in the list", not "is it anywhere".
const listTable = () => screen.findByRole('table', { name: 'Daftar transaksi' })
const inList = async (text: string) => within(await listTable()).findByText(text)
const getInList = (text: string) => within(screen.getByRole('table', { name: 'Daftar transaksi' })).getByText(text)
const queryInList = (text: string) => {
  const table = screen.queryByRole('table', { name: 'Daftar transaksi' })
  return table ? within(table).queryByText(text) : null
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('SaleList: rendering and sorting', () => {
  it('renders sales sorted occurredAt descending', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))

    render(<SaleList />)
    // Wait for the live query to resolve past the loading skeleton (whose
    // rows also match role="row" but carry no text) before reading rows.
    await inList('Pasir')

    const rows = within(await listTable()).getAllByRole('row')
    // rows[0] is the header row; data rows follow. The later sale (19 Sep,
    // Pasir) must render before the earlier one (18 Sep, Semen).
    const dataRows = rows.slice(1)
    expect(dataRows).toHaveLength(2)
    expect(within(dataRows[0]).getByText('Pasir')).toBeInTheDocument()
    expect(within(dataRows[1]).getByText('Semen Tiga Roda')).toBeInTheDocument()
  })

  it('renders a batal sale status with neutral coloring, not danger', async () => {
    const saleId = await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await voidSale(saleId, 'Salah input', at('2026-09-18T08:00:00.000Z'))

    render(<SaleList />)

    const statusPill = await screen.findByText('Batal')
    expect(statusPill).toHaveClass('bg-neutral-bg', 'text-neutral')
    expect(statusPill).not.toHaveClass('bg-danger-bg', 'text-danger')
  })

  it('shows the exact spec empty-state copy when there are no sales at all', async () => {
    render(<SaleList />)

    expect(await screen.findByText('Belum ada transaksi hari ini. Mulai transaksi.')).toBeInTheDocument()
  })

  it('clicking a row opens SaleDetail for that sale inline, without changing the URL', async () => {
    const user = userEvent.setup()
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    const pathBefore = window.location.pathname

    render(<SaleList />)

    const row = await inList('Semen Tiga Roda')
    await user.click(row)

    expect(await screen.findByText('Detail transaksi')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathBefore)
  })
})

describe('SaleList: what each row and the list tell you', () => {
  it('shows the nota number and the time next to the date, so same-day sales can be told apart', async () => {
    const id = await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    render(<SaleList />)

    expect(await screen.findByRole('button', { name: `Buka detail transaksi ${shortNota(id)}` })).toBeInTheDocument()
    expect(screen.getByText(/^\d{2}[.:]\d{2}$/)).toBeInTheDocument()
  })

  it('opens the detail from the nota button by keyboard (Enter), without needing the row itself to be focusable', async () => {
    const user = userEvent.setup()
    const id = await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    render(<SaleList />)

    const button = await screen.findByRole('button', { name: `Buka detail transaksi ${shortNota(id)}` })
    button.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Detail transaksi')).toBeInTheDocument()
    expect(screen.getAllByRole('row').every(row => row.getAttribute('tabindex') === null)).toBe(true)
  })

  it('summarises the listed sales, counting only active ones toward the total', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z')) // 156.000
    await recordSale(pasirCart, at('2026-09-18T08:00:00.000Z')) // 180.000
    const cancelled = await recordSale(pasirCart, at('2026-09-18T09:00:00.000Z'))
    await voidSale(cancelled, 'salah input', at('2026-09-18T09:05:00.000Z'))
    render(<SaleList />)

    expect(await screen.findByTestId('sale-summary')).toHaveTextContent('2 transaksi · Rp 336.000 · 1 batal')
  })
})

describe('SaleList: date shortcuts', () => {
  it('"Hari ini" filters to today and a second tap clears it', async () => {
    const user = userEvent.setup()
    await recordSale(semenCart, { clock: systemClock, deviceId: 'laptop' }) // today
    await recordSale(pasirCart, at('2026-01-02T07:00:00.000Z')) // long ago
    render(<SaleList />)
    await inList('Pasir')

    const hariIni = screen.getByRole('button', { name: 'Hari ini' })
    await user.click(hariIni)
    expect(hariIni).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(queryInList('Pasir')).toBeNull())
    expect(getInList('Semen Tiga Roda')).toBeInTheDocument()

    await user.click(hariIni)
    expect(await inList('Pasir')).toBeInTheDocument()
  })

  it('"Kemarin" shows the no-transactions message when nothing happened yesterday', async () => {
    const user = userEvent.setup()
    await recordSale(semenCart, { clock: systemClock, deviceId: 'laptop' })
    render(<SaleList />)
    await inList('Semen Tiga Roda')

    await user.click(screen.getByRole('button', { name: 'Kemarin' }))

    expect(await screen.findByText('Tidak ada transaksi pada tanggal ini.')).toBeInTheDocument()
  })
})

describe('SaleList: summary', () => {
  it('reads "n transaksi · Rp x" with no cancelled part when nothing was cancelled', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z')) // 156.000
    render(<SaleList />)

    expect(await screen.findByTestId('sale-summary')).toHaveTextContent(/^1 transaksi · Rp 156\.000$/)
  })

  it('shows the same numbers as three visual tiles that are hidden from assistive tech', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    const cancelled = await recordSale(pasirCart, at('2026-09-18T08:00:00.000Z'))
    await voidSale(cancelled, 'salah input', at('2026-09-18T08:05:00.000Z'))
    render(<SaleList />)

    const summary = await screen.findByTestId('sale-summary')
    expect(summary).toHaveClass('sr-only')
    const tiles = document.querySelector('[aria-hidden="true"].grid')!
    expect(tiles).toHaveTextContent('Transaksi')
    expect(tiles).toHaveTextContent('Dibatalkan')
    expect(tiles).toHaveTextContent('Penjualan')
    expect(tiles).toHaveTextContent('Rp 156.000')
    // The money tile gets its own full row until lg, so its figure is never squeezed.
    expect(tiles).toHaveClass('grid-cols-2', 'lg:grid-cols-3')
  })
})

describe('SaleList: the newest nota stays open beside the list', () => {
  it('opens the newest sale straight away, with no click', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))
    render(<SaleList />)

    expect(await screen.findByText('Detail transaksi')).toBeInTheDocument()
    const nota = screen.getByText('Detail transaksi').closest('section') as HTMLElement
    // Pasir is the later sale, so it is the one on the nota.
    expect(await within(nota).findByText('Pasir')).toBeInTheDocument()
    expect(within(nota).queryByText('Semen Tiga Roda')).toBeNull()
  })

  it('marks the open sale in the list, and moves the mark and the nota when another row is chosen', async () => {
    const user = userEvent.setup()
    const semenId = await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    const pasirId = await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))
    render(<SaleList />)

    const pasirButton = await screen.findByRole('button', { name: `Buka detail transaksi ${shortNota(pasirId)}` })
    const semenButton = screen.getByRole('button', { name: `Buka detail transaksi ${shortNota(semenId)}` })
    expect(pasirButton).toHaveAttribute('aria-current', 'true')
    expect(semenButton).not.toHaveAttribute('aria-current')

    await user.click(semenButton)

    expect(semenButton).toHaveAttribute('aria-current', 'true')
    expect(pasirButton).not.toHaveAttribute('aria-current')
    const nota = screen.getByText('Detail transaksi').closest('section') as HTMLElement
    expect(await within(nota).findByText('Semen Tiga Roda')).toBeInTheDocument()
  })

  it('moves to the neighbouring sale with the arrow keys', async () => {
    const user = userEvent.setup()
    const semenId = await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    const pasirId = await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))
    render(<SaleList />)

    const pasirButton = await screen.findByRole('button', { name: `Buka detail transaksi ${shortNota(pasirId)}` })
    pasirButton.focus()
    await user.keyboard('{ArrowDown}')

    const semenButton = screen.getByRole('button', { name: `Buka detail transaksi ${shortNota(semenId)}` })
    expect(semenButton).toHaveAttribute('aria-current', 'true')
    expect(semenButton).toHaveFocus()
  })

  it('does not carry a half-typed cancel reason over to a different sale', async () => {
    const user = userEvent.setup()
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    const pasirId = await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))
    render(<SaleList />)

    await user.click(await screen.findByRole('button', { name: 'Batalkan' }))
    await user.type(screen.getByLabelText(/Alasan pembatalan/), 'salah input')

    await user.click(screen.getAllByRole('button', { name: /Buka detail transaksi/ }).find(b => !b.getAttribute('aria-label')!.includes(shortNota(pasirId)))!)

    expect(screen.queryByLabelText(/Alasan pembatalan/)).toBeNull()
    expect(await screen.findByRole('button', { name: 'Batalkan' })).toBeInTheDocument()
  })

  it('moves the nota to the newest sale of the chosen day when the date filter changes', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))
    render(<SaleList />)
    await inList('Pasir')

    await pilihTanggal(userEvent.setup(), /^Tanggal/, '2026-09-18')

    // Re-query on every retry: the old nota is replaced once the filtered list loads.
    await waitFor(() => {
      const nota = screen.getByText('Detail transaksi').closest('section') as HTMLElement
      expect(within(nota).getByText('Semen Tiga Roda')).toBeInTheDocument()
    })
  })
})

describe('SaleList: metode bayar', () => {
  it('shows Bon, not Tunai, as the method of a Bon sale', async () => {
    await recordSale({ ...semenCart, metodeBayar: 'bon', customerId: 'c1', jatuhTempo: '2026-10-20' }, at('2026-10-03T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-10-02T07:00:00.000Z'))

    render(<SaleList />)
    await inList('Semen Tiga Roda')

    const rows = within(await listTable()).getAllByRole('row').slice(1)
    const bonRow = rows.find(r => within(r).queryByText('Semen Tiga Roda'))!
    const tunaiRow = rows.find(r => within(r).queryByText('Pasir'))!
    expect(within(bonRow).getByText('Bon')).toBeInTheDocument()
    expect(within(bonRow).queryByText('Tunai')).toBeNull()
    expect(within(tunaiRow).getByText('Tunai')).toBeInTheDocument()
  })
})

describe('SaleList: Transfer and QRIS', () => {
  it('names the method of a transfer and a QRIS sale', async () => {
    await recordSale({ ...semenCart, metodeBayar: 'transfer' }, at('2026-10-03T07:00:00.000Z'))
    await recordSale({ ...pasirCart, metodeBayar: 'qris' }, at('2026-10-02T07:00:00.000Z'))

    render(<SaleList />)
    await inList('Semen Tiga Roda')

    const rows = within(await listTable()).getAllByRole('row').slice(1)
    const transfer = rows.find(r => within(r).queryByText('Semen Tiga Roda'))!
    const qris = rows.find(r => within(r).queryByText('Pasir'))!
    expect(within(transfer).getByText('Transfer')).toBeInTheDocument()
    expect(within(qris).getByText('QRIS')).toBeInTheDocument()
  })
})
