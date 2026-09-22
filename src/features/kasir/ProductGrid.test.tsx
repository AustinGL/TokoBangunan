import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { ProductGrid } from './ProductGrid'
import { filterProductRows, computeProductStatus, type ProductRow } from './useProductCatalog'

const semenRow: ProductRow = {
  itemId: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 52000,
  barcode: '8991234567890', kategori: 'Semen', quantity: 50, stokMinimum: 10, status: 'aman',
}
const pasirRow: ProductRow = {
  itemId: 'pasir', nama: 'Pasir Halus', baseUnit: 'm3', hargaEceran: 180000,
  kategori: 'Agregat', quantity: 3, stokMinimum: 5, status: 'menipis',
}

describe('computeProductStatus (matches Stok boundary rules)', () => {
  it('is habis at exactly 0', () => {
    expect(computeProductStatus(0, 10)).toBe('habis')
  })
  it('is menipis one unit below stokMinimum', () => {
    expect(computeProductStatus(9, 10)).toBe('menipis')
  })
  it('is aman at exactly stokMinimum', () => {
    expect(computeProductStatus(10, 10)).toBe('aman')
  })
})

describe('filterProductRows', () => {
  const rows = [semenRow, pasirRow]

  it('matches by nama, case-insensitively', () => {
    expect(filterProductRows(rows, 'semen', null)).toEqual([semenRow])
  })

  it('matches by barcode', () => {
    expect(filterProductRows(rows, '8991234567890', null)).toEqual([semenRow])
  })

  it('returns all rows for an empty query', () => {
    expect(filterProductRows(rows, '', null)).toEqual(rows)
  })

  it('filters by kategori when given', () => {
    expect(filterProductRows(rows, '', 'Agregat')).toEqual([pasirRow])
  })

  it('finds nothing for a query that matches neither nama nor barcode', () => {
    expect(filterProductRows(rows, 'tidak-ada', null)).toEqual([])
  })
})

describe('ProductGrid (live join over real fake-indexeddb)', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await db.itemsProj.bulkPut([
      { id: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak', units: [{ unit: 'sak', factor: 1 }], hargaEceran: 52000, stokMinimum: 10, barcode: '8991234567890', kategori: 'Semen', updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
      { id: 'pasir', nama: 'Pasir Halus', baseUnit: 'm3', units: [{ unit: 'm3', factor: 1 }], hargaEceran: 180000, stokMinimum: 5, kategori: 'Agregat', updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2' },
    ])
    await db.stokProj.bulkPut([
      { itemId: 'semen', quantity: 50000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' },
      { itemId: 'pasir', quantity: 3000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e2' },
    ])
  })

  it('renders a ProductCard per catalog item', async () => {
    render(<ProductGrid searchQuery="" onAdd={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument()
      expect(screen.getByText('Pasir Halus')).toBeInTheDocument()
    })
  })

  it('filters the rendered cards by searchQuery against nama', async () => {
    render(<ProductGrid searchQuery="semen" onAdd={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument())
    expect(screen.queryByText('Pasir Halus')).not.toBeInTheDocument()
  })

  it('filters the rendered cards by searchQuery against barcode', async () => {
    render(<ProductGrid searchQuery="8991234567890" onAdd={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument())
    expect(screen.queryByText('Pasir Halus')).not.toBeInTheDocument()
  })

  it('clicking a card add button calls onAdd with that item and never touches Dexie/commands directly', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ProductGrid searchQuery="" onAdd={onAdd} />)

    await waitFor(() => expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Tambah Semen Tiga Roda ke keranjang' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'semen', nama: 'Semen Tiga Roda' }))

    // The grid's own catalog data must be unaffected by clicking add: no
    // command was invoked, no event written.
    expect(await db.events.count()).toBe(0)
  })
})
