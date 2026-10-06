import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { db } from '../../data/db'
import { recordItem, recordStockPurchase } from '../../data/commands'
import { fixedClock } from '../../domain/clock'
import { ToastProvider } from '../../ui/Toast'
import { BarangDetail } from './BarangDetail'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const seedBarang = (id: string, nama: string, kategori?: string) =>
  db.barangProj.put({ id, nama, kategori, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' })

const seedUkuran = (over: { id: string; barangId?: string; nama: string; baseUnit: string; hargaEceran: number; stokMinimum: number; diarsipkan?: boolean }) =>
  db.itemsProj.put({
    id: over.id, nama: over.nama, baseUnit: over.baseUnit, units: [{ unit: over.baseUnit, factor: 1 }],
    hargaEceran: over.hargaEceran, stokMinimum: over.stokMinimum, barangId: over.barangId,
    diarsipkan: over.diarsipkan ?? false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })

const seedStok = (itemId: string, quantityMilli: number) =>
  db.stokProj.put({ itemId, quantity: quantityMilli, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e2' })

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/stok/:barangKey" element={<BarangDetail />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('BarangDetail', () => {
  it('shows the barang header and an ukuran card per surviving ukuran, with the first selected by default', async () => {
    await seedBarang('b1', 'Semen Tiga Roda', 'Semen')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedUkuran({ id: 'u2', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10 })
    await seedStok('u1', 32000)
    await seedStok('u2', 5000)

    renderAt('/stok/b1')

    expect(await screen.findByRole('heading', { name: /semen tiga roda/i })).toBeInTheDocument()
    const group = within(screen.getByRole('group', { name: /ukuran/i }))
    expect(group.getByRole('button', { name: /50 kg/i })).toHaveAttribute('aria-pressed', 'true')
    expect(group.getByRole('button', { name: /40 kg/i })).toHaveAttribute('aria-pressed', 'false')
    expect(await screen.findByRole('heading', { name: /riwayat stok · 50 kg/i })).toBeInTheDocument()
  })

  it('selects the ukuran named by ?ukuran= on load', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedUkuran({ id: 'u2', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10 })
    await seedStok('u1', 32000)
    await seedStok('u2', 5000)

    renderAt('/stok/b1?ukuran=u2')

    expect(await screen.findByRole('heading', { name: /riwayat stok · 40 kg/i })).toBeInTheDocument()
  })

  it('falls back to the first surviving ukuran when ?ukuran= names an archived or unknown id', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedUkuran({ id: 'u2', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10, diarsipkan: true })
    await seedStok('u1', 32000)

    renderAt('/stok/b1?ukuran=u2')

    expect(await screen.findByRole('heading', { name: /riwayat stok · 50 kg/i })).toBeInTheDocument()
  })

  it('switches to a merged, item-labelled Riwayat table when Semua ukuran is clicked', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedUkuran({ id: 'u2', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10 })
    await recordStockPurchase({ itemId: 'u1', qty: 40, hargaJual: 65000 }, at('2026-09-05T07:00:00.000Z'))
    await recordStockPurchase({ itemId: 'u2', qty: 20, hargaJual: 58000 }, at('2026-09-06T07:00:00.000Z'))
    const user = userEvent.setup()

    renderAt('/stok/b1')
    await screen.findByRole('heading', { name: /riwayat stok · 50 kg/i })

    await user.click(screen.getByRole('button', { name: /semua ukuran/i }))

    expect(await screen.findByRole('heading', { name: /riwayat stok · semua ukuran/i })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + 2 batch rows
  })

  it('shows "—" for a batch with no supplier, and a "Stok lama" row for a nonzero legacy remainder', async () => {
    const itemId = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10, stokAwal: 5 }, at('2026-09-01T07:00:00.000Z'))
    await seedBarang('b1', 'Semen Tiga Roda')
    await db.itemsProj.update(itemId, { barangId: 'b1' })
    await recordStockPurchase({ itemId, qty: 40, hargaJual: 65000 }, at('2026-09-05T07:00:00.000Z'))

    renderAt(`/stok/b1?ukuran=${itemId}`)

    await screen.findByRole('table')
    const dataRows = screen.getAllByRole('row').slice(1)
    expect(dataRows).toHaveLength(2)
    // dataRows[0] is the batch row - batch rows always sort before the
    // legacy row (riwayatStok.ts's own buildRiwayatRows). Its own supplier
    // cell, specifically, must show "—" - asserting "—" appears anywhere in
    // the table would still pass even if the batch's own supplier rendering
    // were broken, since the legacy row's date/supplier/diterima/hargaBeli/
    // hargaJual cells are already always "—" regardless.
    const [tglCell, supplierCell] = within(dataRows[0]).getAllByRole('cell')
    expect(tglCell).not.toHaveTextContent('—')
    expect(supplierCell).toHaveTextContent('—')
    expect(within(dataRows[1]).getByText('Stok lama')).toBeInTheDocument()
  })

  it('opens Atur ukuran with the card\'s own current values', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedStok('u1', 32000)
    const user = userEvent.setup()

    renderAt('/stok/b1')
    await screen.findByRole('heading', { name: /riwayat stok/i })
    await user.click(screen.getByRole('button', { name: /^atur ukuran$/i }))

    const dialog = within(await screen.findByRole('dialog', { name: /atur 50 kg/i }))
    expect(dialog.getByLabelText(/harga jual/i)).toHaveValue('65.000')
  })

  it('opens Koreksi pembelian from a Riwayat row with that batch\'s own values', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await recordStockPurchase({ itemId: 'u1', qty: 40, hargaJual: 67000, hargaBeli: 60000 }, at('2026-09-05T07:00:00.000Z'))
    const user = userEvent.setup()

    renderAt('/stok/b1')
    await user.click(await screen.findByRole('button', { name: /koreksi pembelian/i }))

    const dialog = within(await screen.findByRole('dialog', { name: /koreksi pembelian/i }))
    expect(dialog.getByLabelText(/jumlah/i)).toHaveValue(40)
  })

  it('opens Tambah stok prefilled with this barang and the selected ukuran', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await seedStok('u1', 32000)
    const user = userEvent.setup()

    renderAt('/stok/b1')
    await screen.findByRole('heading', { name: /riwayat stok/i })
    await user.click(screen.getByRole('button', { name: /\+ tambah stok/i }))

    const dialog = within(await screen.findByRole('dialog', { name: /tambah stok/i }))
    expect(dialog.getByRole('combobox', { name: /nama barang/i })).toHaveValue('Semen Tiga Roda')
    expect(dialog.getByRole('combobox', { name: /^ukuran$/i })).toHaveValue('50 kg')
  })

  it('opens an unprefilled Tambah stok for a legacy/virtual barang', async () => {
    // No barangId at all - katalog.ts's own groupUkuranByBarang gives this
    // its virtual barangId "item-legacy-1" (see useKatalog.test.ts's own
    // precedent for the same seeding shape).
    await seedUkuran({ id: 'legacy-1', nama: 'Paku 5cm', baseUnit: 'kg', hargaEceran: 25000, stokMinimum: 5 })
    await seedStok('legacy-1', 5000)
    const user = userEvent.setup()

    renderAt('/stok/item-legacy-1')
    await screen.findByRole('heading', { name: /riwayat stok/i })
    await user.click(screen.getByRole('button', { name: /\+ tambah stok/i }))

    const dialog = within(await screen.findByRole('dialog', { name: /tambah stok/i }))
    expect(dialog.getByRole('combobox', { name: /nama barang/i })).toHaveValue('')
  })

  it('shows a not-found message for an unknown barangKey once katalog has loaded', async () => {
    renderAt('/stok/ghost')

    expect(await screen.findByText(/barang tidak ditemukan/i)).toBeInTheDocument()
  })
})
