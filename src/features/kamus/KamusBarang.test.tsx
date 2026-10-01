import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { KamusBarang } from './KamusBarang'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('KamusBarang: loading and empty states', () => {
  it('renders a distinct loading state before the live query resolves', () => {
    render(<KamusBarang />)
    expect(screen.getByRole('status')).toHaveTextContent(/memuat/i)
  })

  it('renders an empty-state invitation once resolved with no barang', async () => {
    render(<KamusBarang />)
    expect(await screen.findByText(/belum ada barang/i)).toBeInTheDocument()
  })
})

describe('KamusBarang: creating a barang', () => {
  it('opens BarangSheet, submits, and the new barang appears in the list', async () => {
    const user = userEvent.setup()
    render(<KamusBarang />)
    await screen.findByText(/belum ada barang/i)

    await user.click(screen.getByRole('button', { name: /barang baru/i }))
    await user.type(screen.getByLabelText(/nama barang/i), 'Semen Tiga Roda')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
  })

  it('leads straight into the first ukuran of a new barang, instead of leaving a "0 ukuran" row to find', async () => {
    const user = userEvent.setup()
    render(<KamusBarang />)
    await screen.findByText(/belum ada barang/i)

    await user.click(screen.getByRole('button', { name: /barang baru/i }))
    await user.type(screen.getByLabelText(/nama barang/i), 'Semen Tiga Roda')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    // The Ukuran baru sheet opens on its own, with its first field focused.
    expect(await screen.findByRole('dialog', { name: 'Ukuran baru' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^ukuran$/i)).toHaveFocus()
    // And the row behind it is already expanded.
    expect(screen.getByRole('button', { name: /semen tiga roda/i })).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('KamusBarang: expanding a barang and adding an ukuran', () => {
  it('shows ukuran rows when a barang is expanded, and adds a new one via the ukuran sheet', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' })
    const user = userEvent.setup()
    render(<KamusBarang />)

    const barangRow = await screen.findByText('Semen Tiga Roda')
    await user.click(barangRow)

    const panel = await screen.findByTestId('barang-panel-b1')
    await user.click(within(panel).getByRole('button', { name: /tambah ukuran/i }))
    await user.type(screen.getByLabelText(/^ukuran$/i), '50 kg')
    await user.type(screen.getByLabelText(/harga eceran/i), '65000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(await within(panel).findByText('50 kg')).toBeInTheDocument()
  })
})

describe('KamusBarang: legacy (virtual) barang', () => {
  it('hides Ubah barang and Tambah ukuran for a legacy item with no real barang, showing a hint instead', async () => {
    await db.itemsProj.put({
      id: 'legacy-1', nama: 'Paku 5cm', baseUnit: 'kg', units: [{ unit: 'kg', factor: 1 }],
      hargaEceran: 25000, stokMinimum: 5, diarsipkan: false,
      updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
    })
    const user = userEvent.setup()
    render(<KamusBarang />)

    const barangRow = await screen.findByText('Paku 5cm')
    await user.click(barangRow)

    const panel = await screen.findByTestId('barang-panel-item-legacy-1')
    expect(within(panel).queryByRole('button', { name: /ubah barang/i })).toBeNull()
    expect(within(panel).queryByRole('button', { name: /tambah ukuran/i })).toBeNull()
    expect(within(panel).getByText(/barang lama/i)).toBeInTheDocument()
  })

  it('excludes a legacy virtual barang from the "pindahkan ke barang lain" options', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' })
    await db.itemsProj.bulkPut([
      {
        id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }],
        hargaEceran: 65000, stokMinimum: 10, diarsipkan: false,
        updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
      },
      {
        id: 'legacy-1', nama: 'Paku 5cm', baseUnit: 'kg', units: [{ unit: 'kg', factor: 1 }],
        hargaEceran: 25000, stokMinimum: 5, diarsipkan: false,
        updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2',
      },
    ])
    const user = userEvent.setup()
    render(<KamusBarang />)

    const barangRow = await screen.findByText('Semen Tiga Roda')
    await user.click(barangRow)
    const panel = await screen.findByTestId('barang-panel-b1')
    await user.click(within(panel).getByRole('button', { name: /^ubah$/i }))

    await user.click(await screen.findByRole('combobox', { name: /pindahkan ke barang lain/i }))
    const optionLabels = screen.getAllByRole('option').map(o => o.textContent)
    expect(optionLabels).toContain('Semen Tiga Roda')
    expect(optionLabels).not.toContain('Paku 5cm')
  })
})

describe('KamusBarang: archive filter', () => {
  it('hides an archived barang until "Tampilkan arsip" is switched on, showing a distinct no-match message meanwhile', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Lama', diarsipkan: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' })
    const user = userEvent.setup()
    render(<KamusBarang />)

    // Distinct from "Belum ada barang" (the genuinely-empty-katalog case):
    // a barang exists, it's just filtered out.
    expect(await screen.findByText(/tidak ada barang yang cocok/i)).toBeInTheDocument()
    expect(screen.queryByText('Semen Lama')).toBeNull()

    await user.click(screen.getByLabelText(/tampilkan arsip/i))

    expect(await screen.findByText('Semen Lama')).toBeInTheDocument()
  })
})

describe('KamusBarang: toolbar and summary', () => {
  const seed = async () => {
    await db.kategoriProj.bulkPut([
      { id: 'kat_semen', nama: 'Semen', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'k0' },
      { id: 'kat_cat', nama: 'Cat', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'k1' },
      { id: 'kat_lama', nama: 'Kategori Lama', diarsipkan: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'k2' },
    ])
    await db.barangProj.bulkPut([
      { id: 'b1', nama: 'Semen Tiga Roda', kategoriId: 'kat_semen', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' },
      { id: 'b2', nama: 'Cat Tembok Putih', kategoriId: 'kat_cat', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
    ])
    await db.itemsProj.bulkPut([
      {
        id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }],
        hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2',
      },
      {
        id: 'u2', barangId: 'b2', nama: 'Cat Tembok Putih', baseUnit: '5 kg', units: [{ unit: '5 kg', factor: 1 }],
        hargaEceran: 95000, stokMinimum: 5, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e3',
      },
    ])
  }

  it('summarises the active barang and ukuran in the header', async () => {
    await seed()
    render(<KamusBarang />)

    expect(await screen.findByText('2 barang, 2 ukuran')).toBeInTheDocument()
  })

  it('filters by the Kategori dropdown', async () => {
    await seed()
    const user = userEvent.setup()
    render(<KamusBarang />)

    await screen.findByText('Cat Tembok Putih')
    await user.click(await screen.findByRole('combobox', { name: /kategori/i }))
    expect(screen.getByRole('option', { name: 'Semua kategori' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Semen' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Kategori Lama' })).toBeNull()
    await user.click(screen.getByRole('option', { name: 'Cat' }))

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
  })

  it('narrows by the search field, whose label stays "Cari barang"', async () => {
    await seed()
    const user = userEvent.setup()
    render(<KamusBarang />)

    await screen.findByText('Cat Tembok Putih')
    await user.type(screen.getByLabelText('Cari barang'), 'semen')

    expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.queryByText('Cat Tembok Putih')).toBeNull()
  })

  it('falls back to all kategori, instead of hiding every barang, when the chosen kategori disappears', async () => {
    await db.kategoriProj.put({ id: 'kat_cat', nama: 'Cat', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'k0' })
    await db.barangProj.bulkPut([
      { id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' },
      { id: 'b2', nama: 'Cat Tembok Putih', kategoriId: 'kat_cat', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
    ])
    const user = userEvent.setup()
    render(<KamusBarang />)

    await screen.findByText('Cat Tembok Putih')
    await user.click(await screen.findByRole('combobox', { name: /kategori/i }))
    await user.click(screen.getByRole('option', { name: 'Cat' }))
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()

    // Archiving removes the chosen entry from the filter control, while the
    // barang keeps displaying its real archived kategori.
    await db.kategoriProj.update('kat_cat', { diarsipkan: true })

    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText(/tidak ada barang yang cocok/i)).toBeNull()
  })
})
