import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordSale, type RecordSaleInput } from '../../data/commands'
import { fixedClock } from '../../domain/clock'
import { SaleList } from './SaleList'
import { pilihTanggal } from '../../test-utils/pickDate'
import { TanggalFilter } from './TanggalFilter'

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
const queryInList = (text: string) => {
  const table = screen.queryByRole('table', { name: 'Daftar transaksi' })
  return table ? within(table).queryByText(text) : null
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

    expect(await inList('Semen Tiga Roda')).toBeInTheDocument()
    expect(await inList('Pasir')).toBeInTheDocument()
  })

  it('narrows rendered results to only that date\'s occurredAt values', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))

    render(<SaleList />)
    await inList('Semen Tiga Roda')

    await pilihTanggal(userEvent.setup(), /^Tanggal/, '2026-09-18')

    expect(await inList('Semen Tiga Roda')).toBeInTheDocument()
    await waitFor(() => expect(queryInList('Pasir')).not.toBeInTheDocument())
  })

  it('shows the "no transactions on this date" message for a date with no sales, distinct from the fully-empty copy', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))

    render(<SaleList />)
    await inList('Semen Tiga Roda')

    await pilihTanggal(userEvent.setup(), /^Tanggal/, '2026-09-20')

    expect(await screen.findByText('Tidak ada transaksi pada tanggal ini.')).toBeInTheDocument()
    expect(screen.queryByText('Belum ada transaksi hari ini. Mulai transaksi.')).not.toBeInTheDocument()
  })

  it('"Semua" clears the filter back to showing everything', async () => {
    const user = userEvent.setup()
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))

    render(<SaleList />)
    await inList('Semen Tiga Roda')

    await pilihTanggal(userEvent.setup(), /^Tanggal/, '2026-09-18')
    expect(await inList('Semen Tiga Roda')).toBeInTheDocument()
    await waitFor(() => expect(queryInList('Pasir')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Semua' }))

    expect(await inList('Pasir')).toBeInTheDocument()
  })
})

/**
 * The shop this app is built for is always somewhere in Asia (UTC+7/+8/+9),
 * and never UTC. TopNav and formatTanggal.ts both render dates in the
 * browser's local timezone, so the filter's day boundaries must be computed
 * from local midnight too, or it disagrees with the dates printed on this
 * same screen for any sale recorded in the few local morning hours whose
 * UTC timestamp still falls on the previous UTC day.
 *
 * process.env.TZ is read by Node/V8's Date implementation for every new
 * Date(...), including inside jsdom, so pinning it here (rather than relying
 * on whatever timezone happens to run the suite) makes this test meaningful
 * regardless of the machine it runs on.
 */
describe('TanggalFilter: local-day boundaries, not UTC', () => {
  const originalTZ = process.env.TZ

  beforeEach(() => {
    process.env.TZ = 'Asia/Jakarta' // UTC+7, matching the app's target shop
  })

  afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ
    else process.env.TZ = originalTZ
  })

  it('includes a sale under the LOCAL calendar day it falls on, even when that differs from its UTC calendar day', async () => {
    // 2026-09-22T18:30:00.000Z is 2026-09-23T01:30 local time in UTC+7: the
    // local calendar day is 23 Sep, the UTC calendar day is still 22 Sep.
    await recordSale(semenCart, at('2026-09-22T18:30:00.000Z'))

    render(<SaleList />)
    await inList('Semen Tiga Roda')

    await pilihTanggal(userEvent.setup(), /^Tanggal/, '2026-09-23')

    expect(await inList('Semen Tiga Roda')).toBeInTheDocument()
  })

  it('does not file that same sale under the UTC calendar day a UTC-boundary filter would have used', async () => {
    await recordSale(semenCart, at('2026-09-22T18:30:00.000Z'))

    render(<SaleList />)
    await inList('Semen Tiga Roda')

    await pilihTanggal(userEvent.setup(), /^Tanggal/, '2026-09-22')

    expect(await screen.findByText('Tidak ada transaksi pada tanggal ini.')).toBeInTheDocument()
  })
})

describe('TanggalFilter: one control height with its presets', () => {
  it('draws no visible label for the date field, so it lines up with the preset buttons', () => {
    render(<TanggalFilter value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Tanggal/ })).toHaveClass('h-control', 'rounded-pill')
    expect(document.getElementById('transaksi-tanggal-filter-label')).toHaveClass('sr-only')
  })

  it('presets and the date field share one control height', () => {
    render(<TanggalFilter value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Hari ini' })).toHaveClass('h-control')
    expect(screen.getByRole('button', { name: 'Kemarin' })).toHaveClass('h-control')
    expect(screen.getByRole('button', { name: /^Tanggal/ })).toHaveClass('h-control')
  })
})
