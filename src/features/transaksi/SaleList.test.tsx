import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { recordSale, voidSale, type RecordSaleInput } from '../../data/commands'
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

describe('SaleList: rendering and sorting', () => {
  it('renders sales sorted occurredAt descending', async () => {
    await recordSale(semenCart, at('2026-09-18T07:00:00.000Z'))
    await recordSale(pasirCart, at('2026-09-19T07:00:00.000Z'))

    render(<SaleList />)
    // Wait for the live query to resolve past the loading skeleton (whose
    // rows also match role="row" but carry no text) before reading rows.
    await screen.findByText('Pasir')

    const rows = screen.getAllByRole('row')
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

    const row = await screen.findByText('Semen Tiga Roda')
    await user.click(row)

    expect(await screen.findByText('Detail transaksi')).toBeInTheDocument()
    expect(window.location.pathname).toBe(pathBefore)
  })
})
