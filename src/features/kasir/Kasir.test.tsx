import 'fake-indexeddb/auto'
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { Kasir } from './Kasir'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

/**
 * SearchScanField distinguishes a scan from human typing by inter-key
 * interval (its own SCAN_MAX_INTERVAL_MS=30ms threshold). userEvent.type's
 * own internal scheduling still costs a handful of milliseconds per
 * keystroke, which is fine on a quiet machine but flakes under the full
 * suite's parallel load, where an occasional keystroke gap creeps past
 * 30ms. fireEvent dispatches synchronously with no scheduling overhead, so
 * firing one keydown per character back-to-back keeps every interval at
 * effectively 0ms regardless of machine load, then a final Enter completes
 * the scan the same way a real HID scanner burst would.
 */
function simulateScan(input: HTMLElement, value: string) {
  act(() => {
    for (const char of value) {
      fireEvent.keyDown(input, { key: char })
    }
    fireEvent.change(input, { target: { value } })
    fireEvent.keyDown(input, { key: 'Enter' })
  })
}

const seedItem = async (overrides: {
  id: string; nama: string; hargaEceran: number; barcode?: string; baseUnit?: string
}) => {
  await db.itemsProj.put({
    id: overrides.id, nama: overrides.nama, baseUnit: overrides.baseUnit ?? 'sak',
    units: [{ unit: overrides.baseUnit ?? 'sak', factor: 1 }], hargaEceran: overrides.hargaEceran,
    stokMinimum: 5, barcode: overrides.barcode,
    updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })
  await db.stokProj.put({
    itemId: overrides.id, quantity: 50000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1',
  })
}

describe('Kasir: screen assembly and focus', () => {
  it('focuses SearchScanField on mount', () => {
    render(<Kasir />)
    expect(document.activeElement).toBe(screen.getByLabelText('Cari barang'))
  })

  it('renders the heading, ProductGrid and CartPanel together', async () => {
    await seedItem({ id: 'semen', nama: 'Semen Tiga Roda', hargaEceran: 52000, barcode: '8991234567890' })
    render(<Kasir />)

    expect(screen.getByRole('heading', { name: 'Kasir' })).toBeInTheDocument()
    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.getByText('Keranjang')).toBeInTheDocument()
  })

  it('bridges ProductGrid\'s onAdd(item.itemId) to useCart.addItem(id): clicking add puts the item in the cart', async () => {
    await seedItem({ id: 'semen', nama: 'Semen Tiga Roda', hargaEceran: 52000 })
    const user = userEvent.setup()
    render(<Kasir />)

    await user.click(await screen.findByRole('button', { name: 'Tambah Semen Tiga Roda ke keranjang' }))

    // Scoped to the cart panel (the "Keranjang" heading's own card), so this
    // is distinct from ProductCard's own name text elsewhere on the screen.
    // A mismatch in the itemId -> id bridge would leave useCart's line keyed
    // by an undefined itemId and nothing would render here.
    const cartCard = screen.getByText('Keranjang').closest('div')!.parentElement!
    expect(within(cartCard).getByText('Semen Tiga Roda', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda')).toHaveValue(1)
  })
})

describe('Kasir: inline item creation from an unknown barcode scan', () => {
  it('offers "Tambah barang baru" prefilled with the scanned barcode, and creates the item on submit', async () => {
    const user = userEvent.setup()
    render(<Kasir />)

    const search = screen.getByLabelText('Cari barang')
    simulateScan(search, '9990001112223')

    expect(await screen.findByText('Tambah barang baru')).toBeInTheDocument()
    const barcodeField = screen.getByLabelText(/barcode/i)
    expect(barcodeField).toHaveValue('9990001112223')

    await user.type(screen.getByLabelText(/nama barang/i), 'Paku 5cm')
    await user.type(screen.getByLabelText(/satuan dasar/i), 'kg')
    await user.type(screen.getByLabelText(/harga eceran/i), '25000')
    await user.type(screen.getByLabelText(/stok minimum/i), '5')
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    // The panel closes and the new item is addable via the live catalog
    // query, with no manual refresh.
    expect(await screen.findByRole('button', { name: 'Tambah Paku 5cm ke keranjang' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/nama barang/i)).toBeNull()

    const events = await db.events.toArray()
    expect(events.some(e => e.type === 'ItemUpserted')).toBe(true)
  })

  it('adds directly to the cart when the scanned barcode matches a known item, without offering creation', async () => {
    await seedItem({ id: 'semen', nama: 'Semen Tiga Roda', hargaEceran: 52000, barcode: '8991234567890' })
    render(<Kasir />)

    await screen.findByText('Semen Tiga Roda')
    const search = screen.getByLabelText('Cari barang')
    simulateScan(search, '8991234567890')

    await waitFor(() => expect(screen.queryByText('Tambah barang baru')).toBeNull())
    // The scan added straight to the cart: the qty input for this line
    // exists and reads 1.
    expect(await screen.findByLabelText('Jumlah Semen Tiga Roda')).toHaveValue(1)
    // Nothing was created, only added to the cart.
    expect(await db.events.toArray()).toHaveLength(0)
  })
})

describe('Kasir: inline item creation from a typed search with no matches', () => {
  it('offers "Tambah barang baru" prefilled with the typed name once the catalog resolves to zero matches', async () => {
    await seedItem({ id: 'semen', nama: 'Semen Tiga Roda', hargaEceran: 52000 })
    // Typed at normal human speed (a per-keystroke delay above
    // SearchScanField's own scan-detection threshold), so this is ordinary
    // typing, not a scan.
    const user = userEvent.setup({ delay: 40 })
    render(<Kasir />)

    await screen.findByText('Semen Tiga Roda')
    await user.type(screen.getByLabelText('Cari barang'), 'Paku Beton')

    expect(await screen.findByText('Barang "Paku Beton" tidak ditemukan.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tambah barang baru' }))

    expect(screen.getByLabelText(/nama barang/i)).toHaveValue('Paku Beton')
  }, 10000)

  it('does not offer creation while the typed search still matches an existing item', async () => {
    await seedItem({ id: 'semen', nama: 'Semen Tiga Roda', hargaEceran: 52000 })
    const user = userEvent.setup({ delay: 40 })
    render(<Kasir />)

    await screen.findByText('Semen Tiga Roda')
    await user.type(screen.getByLabelText('Cari barang'), 'semen')

    expect(screen.queryByText(/tidak ditemukan/i)).toBeNull()
  }, 10000)
})
