import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { catatBiaya } from '../../data/commands'
import { systemClock } from '../../domain/clock'
import { Biaya } from './Biaya'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const ctx = { clock: systemClock, deviceId: 'laptop' }
const hariLalu = (n: number): string => {
  const d = new Date(); d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('Biaya', () => {
  it('has one h1 named Biaya operasional', () => {
    render(<Biaya />)
    expect(screen.getByRole('heading', { level: 1, name: 'Biaya operasional' })).toBeInTheDocument()
  })

  it('shows an honest empty state', async () => {
    render(<Biaya />)
    expect(await screen.findByText(/Belum ada biaya/)).toBeInTheDocument()
  })

  it('lists expenses newest first with kategori, note and amount', async () => {
    await catatBiaya({ jumlah: 1_500_000, kategori: 'gaji', catatan: 'Agus', tanggal: hariLalu(0) }, ctx)
    await catatBiaya({ jumlah: 250_000, kategori: 'listrik', tanggal: hariLalu(3) }, ctx)
    render(<Biaya />)

    const rows = within(await screen.findByRole('list', { name: 'Daftar biaya' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Gaji')
    expect(rows[0]).toHaveTextContent('Agus')
    expect(rows[0]).toHaveTextContent('1.500.000')
    expect(rows[1]).toHaveTextContent('Listrik')
  })

  it('totals this month, leaving out voided expenses and earlier months', async () => {
    await catatBiaya({ jumlah: 100_000, kategori: 'sewa', tanggal: hariLalu(0) }, ctx)
    const batal = await catatBiaya({ jumlah: 40_000, kategori: 'lainnya', tanggal: hariLalu(0) }, ctx)
    const { batalkanBiaya } = await import('../../data/commands')
    await batalkanBiaya(batal, ctx)
    await catatBiaya({ jumlah: 900_000, kategori: 'gaji', tanggal: hariLalu(70) }, ctx)
    render(<Biaya />)

    const total = (await screen.findByText('Biaya bulan ini')).closest('section') as HTMLElement
    expect(within(total).getByText('Rp 100.000')).toBeInTheDocument()
  })

  it('records an expense from the sheet', async () => {
    const user = userEvent.setup()
    render(<Biaya />)
    await user.click(await screen.findByRole('button', { name: '+ Biaya baru' }))
    await user.type(screen.getByLabelText('Jumlah'), '350000')
    await user.click(screen.getByRole('combobox', { name: 'Kategori' }))
    await user.click(screen.getByRole('option', { name: 'Sewa' }))
    await user.type(screen.getByLabelText('Catatan'), 'Sewa gudang')
    await user.click(screen.getByRole('button', { name: 'Simpan biaya' }))

    await waitFor(async () => expect(await db.expensesProj.count()).toBe(1))
    expect(await db.expensesProj.toArray()).toEqual([expect.objectContaining({ jumlah: 350_000, kategori: 'sewa', catatan: 'Sewa gudang', status: 'aktif' })])
    expect(await screen.findByText('Sewa gudang')).toBeInTheDocument()
  })

  it('does not submit without an amount or a kategori, and says what is missing', async () => {
    const user = userEvent.setup()
    render(<Biaya />)
    await user.click(await screen.findByRole('button', { name: '+ Biaya baru' }))
    await user.click(screen.getByRole('button', { name: 'Simpan biaya' }))

    expect(await screen.findByText('Jumlah wajib diisi dan lebih dari 0.')).toBeInTheDocument()
    expect(screen.getByText('Pilih kategori biaya.')).toBeInTheDocument()
    expect(await db.expensesProj.count()).toBe(0)
  })

  it('cancels an expense only after a confirmation, and keeps it listed as dibatalkan', async () => {
    const user = userEvent.setup()
    const id = await catatBiaya({ jumlah: 100_000, kategori: 'sewa', tanggal: hariLalu(0) }, ctx)
    render(<Biaya />)

    await user.click(await screen.findByRole('button', { name: 'Batalkan biaya Sewa' }))
    expect(await db.expensesProj.get(id)).toMatchObject({ status: 'aktif' })
    await user.click(screen.getByRole('button', { name: 'Ya, batalkan' }))

    expect(await screen.findByText('Dibatalkan')).toBeInTheDocument()
    expect((await db.expensesProj.get(id))?.status).toBe('batal')
    expect(screen.queryByRole('button', { name: 'Batalkan biaya Sewa' })).toBeNull()
  })

  it('backs out of a cancellation', async () => {
    const user = userEvent.setup()
    const id = await catatBiaya({ jumlah: 100_000, kategori: 'sewa', tanggal: hariLalu(0) }, ctx)
    render(<Biaya />)
    await user.click(await screen.findByRole('button', { name: 'Batalkan biaya Sewa' }))
    await user.click(screen.getByRole('button', { name: 'Tidak' }))
    expect((await db.expensesProj.get(id))?.status).toBe('aktif')
    expect(screen.getByRole('button', { name: 'Batalkan biaya Sewa' })).toBeInTheDocument()
  })

  it('corrects an expense from a prefilled sheet: the old one is cancelled, the new one counts', async () => {
    const user = userEvent.setup()
    const lama = await catatBiaya({ jumlah: 100_000, kategori: 'listrik', catatan: 'salah ketik', tanggal: hariLalu(2) }, ctx)
    render(<Biaya />)

    await user.click(await screen.findByRole('button', { name: 'Ubah biaya Listrik' }))
    expect(screen.getByLabelText('Jumlah')).toHaveValue('100.000')
    expect(screen.getByLabelText('Catatan')).toHaveValue('salah ketik')
    expect(screen.getByRole('combobox', { name: 'Kategori' })).toHaveTextContent('Listrik')
    await user.clear(screen.getByLabelText('Jumlah'))
    await user.type(screen.getByLabelText('Jumlah'), '1000000')
    await user.click(screen.getByRole('button', { name: 'Simpan biaya' }))

    await waitFor(async () => expect((await db.expensesProj.get(lama))?.status).toBe('batal'))
    const aktif = (await db.expensesProj.toArray()).filter(e => e.status === 'aktif')
    expect(aktif).toHaveLength(1)
    expect(aktif[0]).toMatchObject({ jumlah: 1_000_000, catatan: 'salah ketik', kategori: 'listrik' })
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Daftar biaya' })).getAllByText('Rp 1.000.000')).toHaveLength(1))
  })

  it('offers no Ubah for a cancelled expense', async () => {
    const id = await catatBiaya({ jumlah: 100_000, kategori: 'sewa', tanggal: hariLalu(0) }, ctx)
    const { batalkanBiaya } = await import('../../data/commands')
    await batalkanBiaya(id, ctx)
    render(<Biaya />)
    await screen.findByText('Dibatalkan')
    expect(screen.queryByRole('button', { name: 'Ubah biaya Sewa' })).toBeNull()
  })
})
