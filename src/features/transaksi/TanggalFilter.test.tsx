import 'fake-indexeddb/auto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { recordSale, type RecordSaleInput } from '../../data/commands'
import { fixedClock } from '../../domain/clock'
import { SaleList } from './SaleList'

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

beforeEach(async () => {
  await db.delete()
  await db.open()
})

/**
 * TanggalFilter is not mounted anywhere on its own: SaleList hosts it as
 * this screen's date filter, the same relationship StockFilters has to
 * ItemList. Real fake-indexeddb data spanning multiple days proves the
 * filter actually narrows salesProj.where('occurredAt').between(...), not
 * just that the input renders.
 */
describe('TanggalFilter: narrows SaleList by date', () => {
  it('shows all sales when no date is chosen (semua, the default)', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))

    render(<SaleList />)

    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(await screen.findByText('Pasir')).toBeInTheDocument()
  })

  it('narrows rendered results to only that date\'s occurredAt values', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))

    render(<SaleList />)
    await screen.findByText('Semen Tiga Roda')

    const dateInput = screen.getByLabelText('Tanggal')
    fireEvent.change(dateInput, { target: { value: '2026-09-18' } })

    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Pasir')).not.toBeInTheDocument())
  })

  it('shows the "no transactions on this date" message for a date with no sales, distinct from the fully-empty copy', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))

    render(<SaleList />)
    await screen.findByText('Semen Tiga Roda')

    const dateInput = screen.getByLabelText('Tanggal')
    fireEvent.change(dateInput, { target: { value: '2026-09-20' } })

    expect(await screen.findByText('Tidak ada transaksi pada tanggal ini.')).toBeInTheDocument()
    expect(screen.queryByText('Belum ada transaksi hari ini. Mulai transaksi.')).not.toBeInTheDocument()
  })

  it('"Tampilkan semua" clears the filter back to showing everything', async () => {
    const user = userEvent.setup()
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))

    render(<SaleList />)
    await screen.findByText('Semen Tiga Roda')

    const dateInput = screen.getByLabelText('Tanggal')
    fireEvent.change(dateInput, { target: { value: '2026-09-18' } })
    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Pasir')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Tampilkan semua' }))

    expect(await screen.findByText('Pasir')).toBeInTheDocument()
  })
})
