import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordItem } from '../../data/commands'
import { ItemList } from './ItemList'

// recordItem is wrapped as a spy over its real implementation, so every
// existing test still writes through to fake-indexeddb as before; only the
// "recordItem fails" test below overrides it for a single call.
vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, recordItem: vi.fn(actual.recordItem) }
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.mocked(recordItem).mockClear()
})

const seedItem = async (overrides: {
  id: string; nama: string; kategori?: string; hargaEceran: number; stokMinimum: number
}) => {
  await db.itemsProj.put({
    id: overrides.id, nama: overrides.nama, baseUnit: 'sak',
    units: [{ unit: 'sak', factor: 1 }], hargaEceran: overrides.hargaEceran,
    stokMinimum: overrides.stokMinimum, kategori: overrides.kategori, diarsipkan: false,
    updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })
}

describe('ItemList: loading and empty states', () => {
  it('renders a distinct, non-blank loading state before the live query resolves', () => {
    render(<ItemList />)

    expect(screen.getByRole('status')).toHaveTextContent(/memuat daftar barang/i)
  })

  it('renders the zero-items invitation copy once the query resolves to an empty list', async () => {
    render(<ItemList />)

    expect(await screen.findByText('Belum ada barang. Mulai tambahkan barang.')).toBeInTheDocument()
    expect(screen.queryByText(/memuat daftar barang/i)).toBeNull()
  })

  it('renders distinct copy for a search that matches nothing, versus zero items overall', async () => {
    await seedItem({ id: 'semen', nama: 'Semen Tiga Roda', hargaEceran: 52000, stokMinimum: 10 })
    const user = userEvent.setup()
    render(<ItemList />)

    await screen.findByText('Semen Tiga Roda')
    await user.type(screen.getByLabelText(/cari barang/i), 'barang yang tidak ada')

    expect(await screen.findByText('Tidak ada barang yang cocok dengan pencarian.')).toBeInTheDocument()
    expect(screen.queryByText('Belum ada barang. Mulai tambahkan barang.')).toBeNull()
  })
})

describe('ItemList: status rendering', () => {
  it('renders habis, menipis and aman as text, not color alone', async () => {
    await seedItem({ id: 'a', nama: 'Barang Habis', hargaEceran: 10000, stokMinimum: 5 })
    await seedItem({ id: 'b', nama: 'Barang Menipis', hargaEceran: 10000, stokMinimum: 10 })
    await db.stokProj.put({ itemId: 'b', quantity: 3000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e2' })
    await seedItem({ id: 'c', nama: 'Barang Aman', hargaEceran: 10000, stokMinimum: 10 })
    await db.stokProj.put({ itemId: 'c', quantity: 50000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e3' })

    render(<ItemList />)

    await screen.findByText('Barang Habis')
    // Status is asserted by its accessible text content, which a color-only
    // indicator would not provide. Scoped to the table because "Habis" and
    // "Menipis" also label the status-filter toggle buttons above it.
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Habis')).toBeInTheDocument()
    expect(table.getByText('Menipis')).toBeInTheDocument()
    expect(table.getByText('Aman')).toBeInTheDocument()
  })

  it('formats rupiah via formatRupiah, never hand-formatted', async () => {
    await seedItem({ id: 'semen', nama: 'Semen Tiga Roda', hargaEceran: 52000, stokMinimum: 10 })
    render(<ItemList />)

    expect(await screen.findByText('Rp 52.000')).toBeInTheDocument()
  })
})

describe('ItemList: item creation round trip', () => {
  it('reveals ItemForm on "+ Tambah barang" and shows the new item after submit, with no manual refresh', async () => {
    const user = userEvent.setup()
    render(<ItemList />)

    await screen.findByText('Belum ada barang. Mulai tambahkan barang.')
    expect(screen.queryByLabelText(/nama barang/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    expect(screen.getByLabelText(/nama barang/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/nama barang/i), 'Semen Tiga Roda')
    await user.type(screen.getByLabelText(/satuan dasar/i), 'sak')
    await user.type(screen.getByLabelText(/harga eceran/i), '52000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    // The live query (not a manual refetch) is what surfaces this row.
    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    // The form hides again after a successful submit.
    expect(screen.queryByLabelText(/nama barang/i)).toBeNull()

    const events = await db.events.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('ItemUpserted')
  })

  it('closes the form via "Tutup" without writing anything', async () => {
    const user = userEvent.setup()
    render(<ItemList />)

    await screen.findByText('Belum ada barang. Mulai tambahkan barang.')
    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    await user.click(screen.getByRole('button', { name: 'Tutup' }))

    expect(screen.queryByLabelText(/nama barang/i)).toBeNull()
    expect(await db.events.toArray()).toHaveLength(0)
  })

  it('shows a visible error and keeps the panel open when recordItem fails', async () => {
    vi.mocked(recordItem).mockRejectedValueOnce(new Error('quota exceeded'))
    const user = userEvent.setup()
    render(<ItemList />)

    await screen.findByText('Belum ada barang. Mulai tambahkan barang.')
    await user.click(screen.getByRole('button', { name: /tambah barang/i }))
    await user.type(screen.getByLabelText(/nama barang/i), 'Semen Tiga Roda')
    await user.type(screen.getByLabelText(/satuan dasar/i), 'sak')
    await user.type(screen.getByLabelText(/harga eceran/i), '52000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    // The failure is surfaced, not silently swallowed.
    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
    // The panel stays open, unlike the successful round trip above, and the
    // entered values are preserved rather than lost.
    expect(screen.getByLabelText(/nama barang/i)).toHaveValue('Semen Tiga Roda')
    // Nothing landed in the event store; the item never appears in the list.
    expect(await db.events.toArray()).toHaveLength(0)
    expect(screen.queryByText('Semen Tiga Roda', { selector: 'td' })).toBeNull()
  })
})
