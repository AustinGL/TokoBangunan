import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { Kasir } from './Kasir'
import { simulateScan } from './testHelpers'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

// A real barangProj row, not just an itemsProj one: groupUkuranByBarang
// (useKatalog.ts) gives a barangId-less item a VIRTUAL barang instead, which
// BarangPicker deliberately excludes (its own barangId cannot be looked up
// in barangProj, so recordUkuran would throw "Barang tidak ditemukan" if a
// caller attached a new ukuran to it) - the "attach to an existing barang"
// scenario below needs the seeded "Semen Tiga Roda" to be a real, pickable
// barang, not a virtual stand-in.
const seedUkuran = async (overrides: { id: string; nama: string; ukuran: string; hargaEceran: number; barcode?: string }) => {
  const barangId = `barang-${overrides.id}`
  await db.barangProj.put({
    id: barangId, nama: overrides.nama, diarsipkan: false,
    updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })
  await db.itemsProj.put({
    id: overrides.id, nama: overrides.nama, baseUnit: overrides.ukuran,
    units: [{ unit: overrides.ukuran, factor: 1 }], hargaEceran: overrides.hargaEceran,
    stokMinimum: 5, barcode: overrides.barcode, diarsipkan: false, barangId,
    updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })
  await db.stokProj.put({ itemId: overrides.id, quantity: 50000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' })
}

describe('Kasir: screen assembly and focus', () => {
  it('focuses SearchScanField on mount', () => {
    render(<Kasir />)
    expect(document.activeElement).toBe(screen.getByLabelText('Cari barang'))
  })

  it('renders the heading, ProductGrid barang cards and CartPanel together', async () => {
    await seedUkuran({ id: 'semen', nama: 'Semen Tiga Roda', ukuran: '50 kg', hargaEceran: 52000, barcode: '8991234567890' })
    render(<Kasir />)

    expect(screen.getByRole('heading', { name: 'Kasir' })).toBeInTheDocument()
    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.getByText('Keranjang')).toBeInTheDocument()
  })

  it('clicking an ukuran\'s add button puts a composed "Nama · Ukuran" line in the cart', async () => {
    await seedUkuran({ id: 'semen', nama: 'Semen Tiga Roda', ukuran: '50 kg', hargaEceran: 52000 })
    const user = userEvent.setup()
    render(<Kasir />)

    await user.click(await screen.findByRole('button', { name: 'Tambah Semen Tiga Roda 50 kg ke keranjang' }))

    const cartCard = screen.getByText('Keranjang').closest('div')!.parentElement!
    expect(within(cartCard).getByText('Semen Tiga Roda · 50 kg', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Jumlah Semen Tiga Roda · 50 kg/)).toHaveValue(1)
  })
})

describe('Kasir: inline creation from an unknown barcode scan', () => {
  it('offers to attach the ukuran to an existing barang, or create a new one, then adds it to the cart', async () => {
    await seedUkuran({ id: 'semen40', nama: 'Semen Tiga Roda', ukuran: '40 kg', hargaEceran: 58000 })
    const user = userEvent.setup()
    render(<Kasir />)
    await screen.findByText('Semen Tiga Roda')

    simulateScan(screen.getByLabelText('Cari barang'), '9990001112223')

    expect(await screen.findByText(/belum dikenal/)).toBeInTheDocument()
    // Attaches the new ukuran to the EXISTING "Semen Tiga Roda" barang.
    await user.click(screen.getByLabelText('Nama barang'))
    await user.click(await screen.findByRole('option', { name: 'Semen Tiga Roda' }))

    expect(await screen.findByLabelText('Barcode')).toHaveValue('9990001112223')
    await user.type(screen.getByLabelText('Ukuran'), '25 kg')
    await user.type(screen.getByLabelText('Harga eceran'), '32000')
    await user.type(screen.getByLabelText('Stok minimum'), '5')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(await screen.findByRole('button', { name: 'Tambah Semen Tiga Roda 25 kg ke keranjang' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Ukuran')).toBeNull()
    const events = await db.events.toArray()
    expect(events.some(e => e.type === 'ItemUpserted')).toBe(true)
    expect(events.some(e => e.type === 'BarangUpserted')).toBe(false) // reused the existing barang, none created
  })

  it('adds directly to the cart when the scanned barcode matches a known ukuran, without offering creation', async () => {
    await seedUkuran({ id: 'semen', nama: 'Semen Tiga Roda', ukuran: '50 kg', hargaEceran: 52000, barcode: '8991234567890' })
    render(<Kasir />)
    await screen.findByText('Semen Tiga Roda')

    simulateScan(screen.getByLabelText('Cari barang'), '8991234567890')

    await waitFor(() => expect(screen.queryByText(/belum dikenal/)).toBeNull())
    expect(await screen.findByLabelText(/^Jumlah Semen Tiga Roda · 50 kg/)).toHaveValue(1)
    expect(await db.events.toArray()).toHaveLength(0)
  })
})

describe('Kasir: inline creation from a typed search with no matches', () => {
  it('offers "Tambah barang baru" and prefills the new barang\'s nama with the typed text', async () => {
    await seedUkuran({ id: 'semen', nama: 'Semen Tiga Roda', ukuran: '50 kg', hargaEceran: 52000 })
    const user = userEvent.setup({ delay: 40 })
    render(<Kasir />)
    await screen.findByText('Semen Tiga Roda')

    await user.type(screen.getByLabelText('Cari barang'), 'Paku Beton')
    expect(await screen.findByText('Barang "Paku Beton" tidak ditemukan.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tambah barang baru' }))
    await user.click(screen.getByRole('button', { name: 'Tambah barang baru' })) // BarangPicker's own "+" quick-add trigger

    // Scoped to the dialog: BarangPicker's own Combobox is also labeled
    // "Nama barang" and stays mounted underneath the open BarangSheet.
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByLabelText('Nama barang')).toHaveValue('Paku Beton')
  }, 10000)

  it('does not offer creation while the typed search still matches an existing ukuran', async () => {
    await seedUkuran({ id: 'semen', nama: 'Semen Tiga Roda', ukuran: '50 kg', hargaEceran: 52000 })
    const user = userEvent.setup({ delay: 40 })
    render(<Kasir />)
    await screen.findByText('Semen Tiga Roda')

    await user.type(screen.getByLabelText('Cari barang'), 'semen')

    expect(screen.queryByText(/tidak ditemukan/i)).toBeNull()
  }, 10000)
})
