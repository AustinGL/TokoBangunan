import 'fake-indexeddb/auto'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { correctBatch } from '../../data/commands'
import { KoreksiPembelianSheet } from './KoreksiPembelianSheet'

vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, correctBatch: vi.fn(actual.correctBatch) }
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.mocked(correctBatch).mockClear()
})

const batch = {
  batchId: 'batch-1', supplierId: 's1', hargaBeli: 58000, hargaJual: 65000,
  tanggalBeli: '2026-09-15T05:00:00.000Z', diterima: 50,
}
const suppliers = [{ id: 's1', nama: 'CV Maju' }, { id: 's2', nama: 'UD Sentosa' }]

const seedItem = (id: string) =>
  db.itemsProj.put({
    id, nama: 'Kaca Putih', baseUnit: 'lbr', units: [{ unit: 'lbr', factor: 1 }],
    hargaEceran: 65000, stokMinimum: 10, diarsipkan: false,
    updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })

const seedBatch = (over: { batchId: string; supplierId?: string; hargaBeli?: number; hargaJual: number; tanggalBeli: string; diterima: number }, itemId: string) =>
  db.batchesProj.put({
    batchId: over.batchId, itemId, supplierId: over.supplierId, hargaBeli: over.hargaBeli,
    hargaJual: over.hargaJual, tanggalBeli: over.tanggalBeli, diterima: over.diterima * 1000,
    sisa: over.diterima * 1000, metaUpdatedAt: '2026-09-18T07:00:00.000Z', metaUpdatedByEventId: 'e0',
    lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e0',
  })

describe('KoreksiPembelianSheet', () => {
  it('prefills supplier, harga beli, harga jual, tanggal beli and jumlah from the batch', () => {
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={batch} suppliers={suppliers} />)

    expect(screen.getByLabelText(/supplier/i)).toHaveValue('s1')
    expect(screen.getByLabelText(/harga beli/i)).toHaveValue('58.000')
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('65.000')
    expect(screen.getByLabelText(/tanggal beli/i)).toHaveValue('2026-09-15')
    expect(screen.getByLabelText(/jumlah/i)).toHaveValue(50)
  })

  it('defaults the supplier field to "Tidak ada" when the batch has none', () => {
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={{ ...batch, supplierId: undefined }} suppliers={suppliers} />)

    expect(screen.getByLabelText(/supplier/i)).toHaveValue('')
  })

  it('calls correctBatch with a corrected jumlah, converting the picked date to local-noon ISO', async () => {
    await seedItem('item-1')
    await seedBatch(batch, 'item-1')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<KoreksiPembelianSheet open onClose={onClose} batch={batch} suppliers={suppliers} />)

    await user.clear(screen.getByLabelText(/jumlah/i))
    await user.type(screen.getByLabelText(/jumlah/i), '40')
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(correctBatch).toHaveBeenCalledWith(
      { batchId: 'batch-1', supplierId: 's1', hargaBeli: 58000, hargaJual: 65000, tanggalBeli: '2026-09-15T05:00:00.000Z', jumlah: 40 },
      expect.objectContaining({ deviceId: expect.any(String) }),
    )
  })

  it('rejects a future tanggal beli at submit time', async () => {
    const user = userEvent.setup()
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={batch} suppliers={suppliers} />)

    const futureIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    // fireEvent.change, not user.type: a native <input type="date">'s
    // segmented editing does not respond to plain keystrokes the way a text
    // input does - same technique TambahStokSheet.test.tsx's own
    // "rejects a future tanggal beli" test already establishes.
    const tanggalInput = screen.getByLabelText(/tanggal beli/i)
    fireEvent.change(tanggalInput, { target: { value: futureIso } })
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByText(/tidak boleh di masa depan/i)).toBeInTheDocument()
    expect(correctBatch).not.toHaveBeenCalled()
  })

  it('rejects a negative jumlah without calling correctBatch', async () => {
    const user = userEvent.setup()
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={batch} suppliers={suppliers} />)

    await user.clear(screen.getByLabelText(/jumlah/i))
    await user.type(screen.getByLabelText(/jumlah/i), '-5')
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByText(/jumlah harus bilangan bulat/i)).toBeInTheDocument()
    expect(correctBatch).not.toHaveBeenCalled()
  })

  it('surfaces a visible error when the write fails, and does not close', async () => {
    vi.mocked(correctBatch).mockRejectedValueOnce(new Error('boom'))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<KoreksiPembelianSheet open onClose={onClose} batch={batch} suppliers={suppliers} />)

    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
    expect(onClose).not.toHaveBeenCalled()
  })
})
