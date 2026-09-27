import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { Stok } from './Stok'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const seedBarang = (id: string, nama: string, kategori?: string, diarsipkan = false) =>
  db.barangProj.put({ id, nama, kategori, diarsipkan, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' })

const seedUkuran = (over: {
  id: string; barangId: string; nama: string; baseUnit: string; hargaEceran: number; stokMinimum: number; diarsipkan?: boolean
}) =>
  db.itemsProj.put({
    id: over.id, nama: over.nama, baseUnit: over.baseUnit, units: [{ unit: over.baseUnit, factor: 1 }],
    hargaEceran: over.hargaEceran, stokMinimum: over.stokMinimum, barangId: over.barangId,
    diarsipkan: over.diarsipkan ?? false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })

const seedStok = (itemId: string, quantityMilli: number) =>
  db.stokProj.put({ itemId, quantity: quantityMilli, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e2' })

describe('Stok', () => {
  it('shows the header summary counting every non-archived barang, a worst-status pill and ukuran chips per row', async () => {
    await seedBarang('b1', 'Semen Tiga Roda', 'Semen')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedUkuran({ id: 'u2', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10 })
    await seedStok('u1', 32000) // 32 whole units, aman
    await seedStok('u2', 0) // habis

    render(<Stok />)

    expect(await screen.findByText('1 barang · 0 menipis · 1 habis')).toBeInTheDocument()
    // Scoped to the row list: StockFilters' own status-toggle bar also has a
    // "Habis" button, so an unscoped getByText matches both.
    const list = within(screen.getByRole('list'))
    expect(list.getByText('Habis')).toBeInTheDocument() // worst of aman/habis is habis
    expect(list.getByText('50 kg · 32')).toBeInTheDocument()
    expect(list.getByText('40 kg · 0')).toBeInTheDocument()
    expect(list.getByText('Rp 58.000 - Rp 65.000')).toBeInTheDocument()
  })

  it('keeps the header summary unchanged while a search narrows the visible rows', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedBarang('b2', 'Cat Tembok Putih')
    await seedUkuran({ id: 'u2', barangId: 'b2', nama: 'Cat Tembok Putih', baseUnit: '5 kg', hargaEceran: 95000, stokMinimum: 5 })
    await seedStok('u1', 50000)
    await seedStok('u2', 0)

    const user = userEvent.setup()
    render(<Stok />)

    expect(await screen.findByText('2 barang · 0 menipis · 1 habis')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/cari barang/i), 'semen')

    expect(screen.queryByText('Cat Tembok Putih')).toBeNull()
    expect(screen.getByText('2 barang · 0 menipis · 1 habis')).toBeInTheDocument()
  })

  it('does not show a barang whose every ukuran is archived', async () => {
    await seedBarang('b1', 'Barang Lama')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Barang Lama', baseUnit: 'pcs', hargaEceran: 1000, stokMinimum: 1, diarsipkan: true })

    render(<Stok />)

    expect(await screen.findByText('Belum ada stok. Tambahkan barang di menu Kamus Barang.')).toBeInTheDocument()
    expect(screen.queryByText('Barang Lama')).toBeNull()
  })

  it('renders a disabled "+ Tambah stok" button, not a link to a screen that does not exist yet', async () => {
    render(<Stok />)
    const button = await screen.findByRole('button', { name: /tambah stok/i })
    expect(button).toBeDisabled()
  })
})
