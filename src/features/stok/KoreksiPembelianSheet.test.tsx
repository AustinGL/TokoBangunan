import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { correctBatch } from '../../data/commands'
import { dateAtLocalNoon } from '../../domain/tanggal'
import { KoreksiPembelianSheet } from './KoreksiPembelianSheet'
import { bukaKalender, pilihTanggal } from '../../test-utils/pickDate'
import { bulanDari, namaBulan, ringkas } from '../../domain/kalender'
import { todayIsoDate } from '../../domain/tanggal'
import { systemClock } from '../../domain/clock'

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
  // Derived via dateAtLocalNoon rather than a hardcoded UTC literal, so this
  // stays correct regardless of the test runner's own local timezone (a
  // literal like '2026-09-15T05:00:00.000Z' only round-trips to local date
  // "2026-09-15" in UTC+7).
  tanggalBeli: dateAtLocalNoon('2026-09-15').toISOString(), diterima: 50,
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

    expect(screen.getByLabelText(/supplier/i)).toHaveTextContent('CV Maju')
    expect(screen.getByLabelText(/harga beli/i)).toHaveValue('58.000')
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('65.000')
    expect(screen.getByLabelText(/tanggal beli/i)).toHaveTextContent('15 Sep 2026')
    expect(screen.getByLabelText(/jumlah/i)).toHaveValue(50)
  })

  it('puts focus on the supplier field, the first field, when it opens', () => {
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={batch} suppliers={suppliers} />)

    expect(screen.getByLabelText(/supplier/i)).toHaveFocus()
  })

  it('defaults the supplier field to "Tidak ada" when the batch has none', () => {
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={{ ...batch, supplierId: undefined }} suppliers={suppliers} />)

    expect(screen.getByLabelText(/supplier/i)).toHaveTextContent('Tidak ada')
  })

  it('prefills tanggal beli using local calendar day, not UTC slice, for early-morning timestamps', () => {
    // A batch recorded at 2026-09-15T23:30:00.000Z (UTC) - late enough in
    // the UTC day that a positive-offset local timezone (e.g. UTC+7) rolls
    // it over to the next LOCAL calendar day, which .slice(0, 10) (a UTC
    // slice) would miss.
    const earlyMorningInstant = new Date(Date.UTC(2026, 8, 15, 23, 30, 0))
    const earlyMorningBatch = { ...batch, tanggalBeli: earlyMorningInstant.toISOString() }
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={earlyMorningBatch} suppliers={suppliers} />)

    // Expected value computed from the SAME instant's own local Date fields
    // (mirrors toIsoDate's own implementation) rather than a hardcoded
    // string, so this assertion is correct under any local timezone the
    // test runner happens to use, not just UTC+7.
    const year = earlyMorningInstant.getFullYear()
    const month = String(earlyMorningInstant.getMonth() + 1).padStart(2, '0')
    const day = String(earlyMorningInstant.getDate()).padStart(2, '0')
    expect(screen.getByLabelText(/tanggal beli/i)).toHaveTextContent(ringkas(`${year}-${month}-${day}`))
  })

  it('calls correctBatch with a corrected jumlah, keeping tanggal beli unchanged when the date field is untouched', async () => {
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
      // tanggalBeli must be the batch's own ORIGINAL string, untouched - not
      // noon-converted - because the date field itself was never edited. A
      // real same-day purchase timestamp (e.g. recorded at 09:15) must
      // survive a correction that only touches jumlah, or it would silently
      // get moved to noon on every unrelated correction.
      { batchId: 'batch-1', supplierId: 's1', hargaBeli: 58000, hargaJual: 65000, tanggalBeli: batch.tanggalBeli, jumlah: 40 },
      expect.objectContaining({ deviceId: expect.any(String) }),
    )
  })

  it('converts tanggal beli to local-noon ISO when the date field is actually changed', async () => {
    await seedItem('item-1')
    await seedBatch(batch, 'item-1')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<KoreksiPembelianSheet open onClose={onClose} batch={batch} suppliers={suppliers} />)

    await pilihTanggal(user, /Tanggal beli/, '2026-09-10')
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    // Expected value derived via dateAtLocalNoon at test-run time, not a
    // hardcoded UTC literal, so this holds regardless of the runner's own
    // local timezone.
    expect(correctBatch).toHaveBeenCalledWith(
      expect.objectContaining({ tanggalBeli: dateAtLocalNoon('2026-09-10').toISOString() }),
      expect.anything(),
    )
  })

  it('offers no day after today for tanggal beli', async () => {
    const user = userEvent.setup()
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={batch} suppliers={suppliers} />)

    const kartu = await bukaKalender(user, /Tanggal beli/)
    // Page forward until the edge: it must be this month, never a later one.
    for (let i = 0; i < 600 && !within(kartu).getByRole('button', { name: 'Bulan berikutnya' }).hasAttribute('disabled'); i += 1) {
      await user.click(within(kartu).getByRole('button', { name: 'Bulan berikutnya' }))
    }

    expect(within(kartu).getByRole('button', { name: 'Bulan berikutnya' })).toBeDisabled()
    expect(within(kartu).getByRole('heading')).toHaveTextContent(namaBulan(bulanDari(todayIsoDate(systemClock))))
    expect(correctBatch).not.toHaveBeenCalled()
  })

  it('rejects a negative jumlah without calling correctBatch', async () => {
    const user = userEvent.setup()
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={batch} suppliers={suppliers} />)

    await user.clear(screen.getByLabelText(/jumlah/i))
    await user.type(screen.getByLabelText(/jumlah/i), '-5')
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByText(/jumlah wajib diisi/i)).toBeInTheDocument()
    expect(correctBatch).not.toHaveBeenCalled()
  })

  it('rejects an empty jumlah without calling correctBatch', async () => {
    const user = userEvent.setup()
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={batch} suppliers={suppliers} />)

    // Number('') is 0, so an emptied field must be rejected explicitly - it
    // must not silently validate as "0" and call correctBatch, which would
    // emit a StockAdjusted('koreksi') zeroing the batch's sisa.
    await user.clear(screen.getByLabelText(/jumlah/i))
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByText(/jumlah wajib diisi/i)).toBeInTheDocument()
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

describe('KoreksiPembelianSheet: footer', () => {
  it('keeps the save button inside a sticky footer', () => {
    render(<KoreksiPembelianSheet open onClose={vi.fn()} batch={batch} suppliers={suppliers} />)
    expect(screen.getByRole('button', { name: 'Simpan' }).parentElement).toHaveClass('sticky', 'bottom-0')
  })
})
