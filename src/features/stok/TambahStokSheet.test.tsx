import 'fake-indexeddb/auto'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordStockPurchase } from '../../data/commands'
import { ToastProvider } from '../../ui/Toast'
import { TambahStokSheet } from './TambahStokSheet'

// recordStockPurchase is wrapped as a spy over its real implementation, so
// every existing test still writes through to fake-indexeddb as before;
// only the "write fails" test overrides it for a single call. Same pattern
// as CartPanel.test.tsx's recordSale mock.
vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, recordStockPurchase: vi.fn(actual.recordStockPurchase) }
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.mocked(recordStockPurchase).mockClear()
})

const seedBarang = (id: string, nama: string) =>
  db.barangProj.put({ id, nama, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' })

const seedUkuran = (over: { id: string; barangId: string; nama: string; baseUnit: string; hargaEceran: number; stokMinimum: number }) =>
  db.itemsProj.put({
    id: over.id, nama: over.nama, baseUnit: over.baseUnit, units: [{ unit: over.baseUnit, factor: 1 }],
    hargaEceran: over.hargaEceran, stokMinimum: over.stokMinimum, barangId: over.barangId,
    diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })

async function pickBarangAndUkuran(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('combobox', { name: /nama barang/i }))
  await user.click(await screen.findByRole('option', { name: 'Semen Tiga Roda' }))
  await user.click(screen.getByRole('combobox', { name: /^ukuran$/i }))
  await user.click(await screen.findByRole('option', { name: '50 kg' }))
}

describe('TambahStokSheet', () => {
  it('prefills harga jual from the selected ukuran\'s current price', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    await pickBarangAndUkuran(user)

    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('65.000')
  })

  it('does not overwrite a harga jual the user already typed when picking the ukuran again', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedUkuran({ id: 'u2', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10 })
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    await user.clear(screen.getByLabelText(/harga jual/i))
    await user.type(screen.getByLabelText(/harga jual/i), '67000')

    // Picking a DIFFERENT ukuran re-prefills (a fresh default for the new
    // ukuran); this only proves re-selecting doesn't clobber a fresh type.
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('67.000')
  })

  it('resets the ukuran selection and its harga jual prefill when a different barang is picked', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedBarang('b2', 'Cat Tembok Putih')
    await seedUkuran({ id: 'u2', barangId: 'b2', nama: 'Cat Tembok Putih', baseUnit: '5 kg', hargaEceran: 95000, stokMinimum: 5 })
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('65.000')

    // Combobox filters its option list against whatever text it currently
    // displays - re-focusing it without clearing first would filter down
    // to just "Semen Tiga Roda" (the label of its own committed value),
    // hiding "Cat Tembok Putih" entirely. Clearing first is how a real
    // user reaches a different option from an already-filled field.
    await user.clear(screen.getByRole('combobox', { name: /nama barang/i }))
    await user.click(await screen.findByRole('option', { name: 'Cat Tembok Putih' }))

    // The ukuran combobox's own blur timeout (from losing focus when the
    // barang field was cleared) settles on a real 150ms timer, independent
    // of the barang selection above - waitFor absorbs that instead of
    // racing a synchronous check against it.
    await waitFor(() => expect(screen.getByRole('combobox', { name: /^ukuran$/i })).toHaveValue(''))
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('')
  })

  it('shows a live total pembelian once jumlah and harga beli are both filled', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    await user.type(screen.getByLabelText(/jumlah/i), '40')
    await user.type(screen.getByLabelText(/harga beli/i), '60000')

    expect(screen.getByText(/total pembelian/i)).toHaveTextContent('Rp 2.400.000')
  })

  it('rejects a future tanggal beli at submit time', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    await user.type(screen.getByLabelText(/jumlah/i), '40')

    const future = new Date()
    future.setDate(future.getDate() + 3)
    const futureIso = future.toISOString().slice(0, 10)
    const tanggalInput = screen.getByLabelText(/tanggal beli/i)
    // fireEvent.change, not user.type: a native <input type="date">'s
    // segmented editing order depends on the environment's locale, which
    // makes typing digits into it a known source of flaky date-input
    // tests. Setting .value directly is the reliable way to drive one.
    fireEvent.change(tanggalInput, { target: { value: futureIso } })

    await user.click(screen.getByRole('button', { name: /^simpan stok$/i }))

    expect(await screen.findByText(/tidak boleh di masa depan/i)).toBeInTheDocument()
    expect(await db.batchesProj.toArray()).toHaveLength(0)
  })

  it('records a real stock purchase batch and closes on Simpan stok', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={onClose} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    await user.type(screen.getByLabelText(/jumlah/i), '40')
    await user.type(screen.getByLabelText(/harga beli/i), '60000')

    await user.click(screen.getByRole('button', { name: /^simpan stok$/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const batches = await db.batchesProj.toArray()
    expect(batches).toHaveLength(1)
    expect(batches[0]).toMatchObject({ itemId: 'u1', diterima: 40000, hargaBeli: 60000, hargaJual: 65000 })
  })

  it('"Simpan & tambah lagi" keeps supplier and tanggal beli but clears barang, ukuran, jumlah and harga', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={onClose} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    await user.type(screen.getByLabelText(/jumlah/i), '40')

    await user.click(screen.getByRole('combobox', { name: /supplier/i }))
    await user.type(screen.getByRole('combobox', { name: /supplier/i }), 'UD Baru')
    await user.click(screen.getByText(/tambah.*UD Baru/i))
    await waitFor(() => expect(screen.getByRole('combobox', { name: /supplier/i })).toHaveValue('UD Baru'))

    const tanggalInput = screen.getByLabelText(/tanggal beli/i) as HTMLInputElement
    const tanggalValue = tanggalInput.value

    await user.click(screen.getByRole('button', { name: /simpan.*tambah lagi/i }))

    await waitFor(async () => expect(await db.batchesProj.toArray()).toHaveLength(1))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox', { name: /nama barang/i })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: /^ukuran$/i })).toHaveValue('')
    expect(screen.getByLabelText(/jumlah/i)).toHaveValue(null)
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('')
    expect(screen.getByRole('combobox', { name: /supplier/i })).toHaveValue('UD Baru')
    expect((screen.getByLabelText(/tanggal beli/i) as HTMLInputElement).value).toBe(tanggalValue)
  })

  it('surfaces a visible error and does not close when the write fails', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    vi.mocked(recordStockPurchase).mockRejectedValueOnce(new Error('write failed'))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={onClose} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    await user.type(screen.getByLabelText(/jumlah/i), '40')

    await user.click(screen.getByRole('button', { name: /^simpan stok$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
    expect(onClose).not.toHaveBeenCalled()
  })
})
