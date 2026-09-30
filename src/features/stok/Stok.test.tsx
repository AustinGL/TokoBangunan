import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, useNavigationType } from 'react-router-dom'
import { db } from '../../data/db'
import { ToastProvider } from '../../ui/Toast'
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

// Exposes the current history entry's navigation type (PUSH/REPLACE/POP) as
// text, so a test can assert Stok's own URL updates use the right one -
// MemoryRouter keeps its history internal, with no other way to inspect it.
function NavigationTypeProbe() {
  return <span data-testid="nav-type">{useNavigationType()}</span>
}

describe('Stok', () => {
  it('shows the summary tiles counting every non-archived barang, a worst-status pill and ukuran chips per row', async () => {
    await seedBarang('b1', 'Semen Tiga Roda', 'Semen')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedUkuran({ id: 'u2', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10 })
    await seedStok('u1', 32000) // 32 whole units, aman
    await seedStok('u2', 0) // habis

    render(<MemoryRouter><Stok /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: 'Semua barang: 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menipis: 0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Habis: 1' })).toBeInTheDocument()
    expect(screen.getByText('1 barang')).toBeInTheDocument()
    // Scoped to the row list: the Habis status tile above also says "Habis".
    const list = within(screen.getByRole('list'))
    expect(list.getByText('Habis')).toBeInTheDocument() // worst of aman/habis is habis
    expect(list.getByText('50 kg · 32')).toBeInTheDocument()
    expect(list.getByText('40 kg · 0')).toBeInTheDocument()
    expect(list.getByText('Rp 58.000 - Rp 65.000')).toBeInTheDocument()
  })

  it('keeps the summary tiles unchanged while a search narrows the visible rows', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedBarang('b2', 'Cat Tembok Putih')
    await seedUkuran({ id: 'u2', barangId: 'b2', nama: 'Cat Tembok Putih', baseUnit: '5 kg', hargaEceran: 95000, stokMinimum: 5 })
    await seedStok('u1', 50000)
    await seedStok('u2', 0)

    const user = userEvent.setup()
    render(<MemoryRouter><Stok /></MemoryRouter>)

    expect(await screen.findByRole('button', { name: 'Semua barang: 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Habis: 1' })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/cari barang/i), 'semen')

    expect(screen.queryByText('Cat Tembok Putih')).toBeNull()
    expect(screen.getByRole('button', { name: 'Semua barang: 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Habis: 1' })).toBeInTheDocument()
  })

  it('does not show a barang whose every ukuran is archived', async () => {
    await seedBarang('b1', 'Barang Lama')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Barang Lama', baseUnit: 'pcs', hargaEceran: 1000, stokMinimum: 1, diarsipkan: true })

    render(<MemoryRouter><Stok /></MemoryRouter>)

    expect(await screen.findByText('Belum ada stok. Tambahkan barang di menu Kamus Barang.')).toBeInTheDocument()
    expect(screen.queryByText('Barang Lama')).toBeNull()
  })

  it('links each barang row to its own Barang detail page', async () => {
    await seedBarang('b1', 'Semen Tiga Roda', 'Semen')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedStok('u1', 32000)

    render(<MemoryRouter><Stok /></MemoryRouter>)

    const link = await screen.findByRole('link', { name: /semen tiga roda/i })
    expect(link).toHaveAttribute('href', '/stok/b1')
  })

  it('filters by the Habis tile, and clicking the pressed tile again clears it, with counts unchanged', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedBarang('b2', 'Cat Tembok Putih')
    await seedUkuran({ id: 'u2', barangId: 'b2', nama: 'Cat Tembok Putih', baseUnit: '5 kg', hargaEceran: 95000, stokMinimum: 5 })
    await seedStok('u1', 50000)
    await seedStok('u2', 0)
    const user = userEvent.setup()
    render(<MemoryRouter><Stok /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: 'Habis: 1' }))
    expect(screen.getByRole('button', { name: 'Habis: 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
    expect(screen.getByRole('button', { name: 'Semua barang: 2' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Habis: 1' }))
    expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
  })

  it('shows no tiles and no toolbar, only the empty state, when there is no stock at all', async () => {
    render(<MemoryRouter><Stok /></MemoryRouter>)

    expect(await screen.findByText('Belum ada stok. Tambahkan barang di menu Kamus Barang.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filter status stok' })).toBeNull()
    expect(screen.queryByLabelText(/cari barang/i)).toBeNull()
    expect(screen.getByRole('link', { name: 'Buka Kamus Barang' })).toHaveAttribute('href', '/kamus')
  })

  it('shows a no-match state for a search that matches nothing, and Reset filter brings the rows back', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedStok('u1', 50000)
    const user = userEvent.setup()
    render(<MemoryRouter><Stok /></MemoryRouter>)

    await user.type(await screen.findByLabelText(/cari barang/i), 'zzz-tidak-ada')
    expect(screen.getByText('Tidak ada barang yang cocok dengan pencarian atau filter.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset filter' }))
    expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.queryByText('Tidak ada barang yang cocok dengan pencarian atau filter.')).toBeNull()
  })

  it('shows a busy skeleton, not the empty state, while the stock is still loading', () => {
    render(<MemoryRouter><Stok /></MemoryRouter>)

    expect(screen.getByRole('status')).toHaveTextContent('Memuat daftar stok...')
    expect(screen.queryByText(/belum ada stok/i)).toBeNull()
  })
})

describe('Stok: Tambah stok', () => {
  it('enables the + Tambah stok button, and opens the sheet via ?tambah=1', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ToastProvider><Stok /></ToastProvider></MemoryRouter>)

    const button = await screen.findByRole('button', { name: /tambah stok/i })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(await screen.findByRole('heading', { name: 'Tambah stok' })).toBeInTheDocument()
  })

  it('opens the sheet directly when the URL already carries ?tambah=1', async () => {
    render(
      <MemoryRouter initialEntries={['/stok?tambah=1']}>
        <ToastProvider><Stok /></ToastProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Tambah stok' })).toBeInTheDocument()
  })

  it('prefills barang and ukuran when a Beranda "Perlu diurus" link carries them', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    render(
      <MemoryRouter initialEntries={['/stok?tambah=1&barang=b1&ukuran=u1']}>
        <ToastProvider><Stok /></ToastProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('combobox', { name: /nama barang/i })).toHaveValue('Semen Tiga Roda'))
    expect(screen.getByRole('combobox', { name: /^ukuran$/i })).toHaveValue('50 kg')
  })

  it('closes the sheet via its own Tutup button', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/stok?tambah=1']}>
        <ToastProvider><Stok /></ToastProvider>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Tambah stok' })
    await user.click(screen.getByRole('button', { name: 'Tutup' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Tambah stok' })).toBeNull())
  })

  it('closes without pushing a new history entry, so Back does not silently re-open the sheet', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/stok?tambah=1']}>
        <ToastProvider><Stok /></ToastProvider>
        <NavigationTypeProbe />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Tambah stok' })
    await user.click(screen.getByRole('button', { name: 'Tutup' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Tambah stok' })).toBeNull())

    // REPLACE (not PUSH): closing must overwrite the "opened" history entry
    // rather than add a new one on top of it, or pressing the browser's own
    // Back button after closing would land back on ?tambah=1 and silently
    // re-open the sheet with an empty form.
    expect(screen.getByTestId('nav-type')).toHaveTextContent('REPLACE')
  })
})
