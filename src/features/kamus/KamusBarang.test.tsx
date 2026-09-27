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
