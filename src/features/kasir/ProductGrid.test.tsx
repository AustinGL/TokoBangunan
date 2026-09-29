import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { ProductGrid } from './ProductGrid'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const seedUkuran = async (id: string, nama: string, ukuran: string, hargaEceran: number, kategori?: string) => {
  await db.itemsProj.put({
    id, nama, baseUnit: ukuran, units: [{ unit: ukuran, factor: 1 }], hargaEceran, stokMinimum: 5,
    kategori, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })
  await db.stokProj.put({ itemId: id, quantity: 32000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' })
}

describe('ProductGrid', () => {
  it('renders one card per barang (a legacy item with no barangId becomes its own virtual barang card)', async () => {
    await seedUkuran('semen50', 'Semen Tiga Roda', '50 kg', 65000, 'Semen')
    render(<ProductGrid searchQuery="" onAdd={vi.fn()} />)

    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.getByText('50 kg')).toBeInTheDocument()
  })

  it('filters by the typed search query across barang nama and ukuran text', async () => {
    await seedUkuran('semen50', 'Semen Tiga Roda', '50 kg', 65000)
    await seedUkuran('pasir', 'Pasir Halus', 'm3', 180000)
    render(<ProductGrid searchQuery="pasir" onAdd={vi.fn()} />)

    await screen.findByText('Pasir Halus')
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
  })

  it('shows "Tidak ada barang yang cocok dengan pencarian" for a query matching nothing', async () => {
    await seedUkuran('semen50', 'Semen Tiga Roda', '50 kg', 65000)
    render(<ProductGrid searchQuery="paku beton" onAdd={vi.fn()} />)

    expect(await screen.findByText('Tidak ada barang yang cocok dengan pencarian.')).toBeInTheDocument()
  })

  it('clicking an ukuran row\'s add button calls onAdd with the ukuran row and its barang\'s nama', async () => {
    await seedUkuran('semen50', 'Semen Tiga Roda', '50 kg', 65000)
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ProductGrid searchQuery="" onAdd={onAdd} />)

    await user.click(await screen.findByRole('button', { name: 'Tambah Semen Tiga Roda 50 kg ke keranjang' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 'semen50', ukuran: '50 kg' }), 'Semen Tiga Roda')
  })
})
