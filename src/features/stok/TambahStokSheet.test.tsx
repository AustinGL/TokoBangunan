import 'fake-indexeddb/auto'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
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

  it('does not overwrite a harga jual the user already typed when re-picking the same ukuran', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    await user.clear(screen.getByLabelText(/harga jual/i))
    await user.type(screen.getByLabelText(/harga jual/i), '67000')

    // Re-selecting the SAME ukuran (e.g. the user double-checks their pick)
    // must not re-trigger the prefill and clobber the just-typed price -
    // Combobox.commit calls onChange even for the option already selected.
    await user.clear(screen.getByRole('combobox', { name: /^ukuran$/i }))
    await user.click(await screen.findByRole('option', { name: '50 kg' }))

    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('67.000')
  })

  it('prefills harga jual with a quick-added ukuran\'s own price, not a stale price from a previous selection', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    await pickBarangAndUkuran(user)
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('65.000')

    await user.click(screen.getByRole('button', { name: /tambah ukuran baru/i }))
    // Scoped by accessible name (Sheet's title): TambahStokSheet is itself
    // a dialog, so an unscoped getByRole('dialog') now matches both it and
    // the nested UkuranSheet.
    const dialog = within(screen.getByRole('dialog', { name: 'Ukuran baru' }))
    await user.type(dialog.getByLabelText(/^ukuran$/i), '40 kg')
    await user.type(dialog.getByLabelText(/harga eceran/i), '58000')
    await user.type(dialog.getByLabelText(/stok minimum/i), '10')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    // Quick-add resolves after useKatalog's own live query has re-fetched,
    // so the new ukuran's price must come from the picker's own onChange,
    // not a stale lookup into whatever katalog data TambahStokSheet still
    // held at the moment the write settled.
    await waitFor(() => expect(screen.getByLabelText(/harga jual/i)).toHaveValue('58.000'))
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

  it('focuses a summary of all field errors when submitting with more than one validation error, matching ItemForm\'s pattern', async () => {
    const user = userEvent.setup()
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    // An entirely empty form: barang, ukuran, jumlah and harga jual are all
    // required and blank - four errors, well past ItemForm's own ">1"
    // threshold for showing a summary rather than relying on the inline
    // per-field errors alone.
    await user.click(screen.getByRole('button', { name: /^simpan stok$/i }))

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent(/periksa kembali isian berikut/i)
    expect(summary).toHaveTextContent(/nama barang/i)
    expect(summary).toHaveTextContent(/ukuran/i)
    expect(summary).toHaveFocus()
  })

  it('prefills barang, ukuran and harga jual from initialBarangId/initialItemId/initialHargaJual', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })

    render(
      <ToastProvider>
        <TambahStokSheet open onClose={vi.fn()} initialBarangId="b1" initialItemId="u1" initialHargaJual={67000} />
      </ToastProvider>,
    )

    await waitFor(() => expect(screen.getByRole('combobox', { name: /nama barang/i })).toHaveValue('Semen Tiga Roda'))
    expect(screen.getByRole('combobox', { name: /^ukuran$/i })).toHaveValue('50 kg')
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('67.000')
  })

  it('opens an empty form when no prefill props are given, same as before', async () => {
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)

    expect(screen.getByRole('combobox', { name: /nama barang/i })).toHaveValue('')
    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('')
  })
})

describe('TambahStokSheet: footer', () => {
  it('keeps both save buttons inside a sticky footer', async () => {
    render(<ToastProvider><TambahStokSheet open onClose={vi.fn()} /></ToastProvider>)
    const save = await screen.findByRole('button', { name: 'Simpan stok' })
    expect(save.parentElement).toHaveClass('sticky', 'bottom-0')
    expect(screen.getByRole('button', { name: 'Simpan & tambah lagi' }).parentElement).toBe(save.parentElement)
  })
})
