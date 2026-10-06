import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import type { Sale } from '../../domain/projections/sales'
import { Laporan } from './Laporan'
import { ringkas } from '../../domain/kalender'
import { todayIsoDate } from '../../domain/tanggal'
import { systemClock } from '../../domain/clock'
import { pilihRentang, bukaKalender } from '../../test-utils/pickDate'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const TS = '2026-09-18T07:00:00.000Z'
const now = () => new Date().toISOString()

const seedKatalog = async () => {
  await db.barangProj.put({ id: 'br1', nama: 'Semen', kategori: 'Semen', diarsipkan: false, updatedAt: TS, updatedByEventId: 'e' })
  await db.itemsProj.put({ id: 'u1', nama: 'Semen', baseUnit: 'sak', units: [{ unit: 'sak', factor: 1 }], hargaEceran: 100_000, stokMinimum: 0, barangId: 'br1', diarsipkan: false, updatedAt: TS, updatedByEventId: 'e' })
}
const seedBatch = (over: { batchId?: string; hargaBeli?: number } = {}) =>
  db.batchesProj.put({ batchId: over.batchId ?? 'b1', itemId: 'u1', hargaBeli: 'hargaBeli' in over ? over.hargaBeli : 60_000, hargaJual: 100_000, tanggalBeli: now(), diterima: 10_000, sisa: 9_000, metaUpdatedAt: TS, metaUpdatedByEventId: 'e', lastMovementAt: TS, lastMovementEventId: 'e' })
const seedSale = (id: string, lines: Sale['lines'], total: number, over: Partial<Sale> = {}) =>
  db.salesProj.put({
    id, lines, metodeBayar: 'tunai', subtotal: total, diskon: 0, total, deliveryIntent: 'dibawa',
    occurredAt: now(), recordedAt: now(), deviceId: 'd1', status: 'aktif', itemIds: lines.map(l => l.itemId), batchIds: [], ...over,
  })
const line = (over: Partial<Sale['lines'][number]> = {}): Sale['lines'][number] => ({
  itemId: 'u1', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 100_000, subtotal: 100_000, batchId: 'b1', ...over,
})

describe('Laporan', () => {
  it('has one h1 named Laporan and a period selector defaulting to Bulan ini', async () => {
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'Laporan' })).toBeInTheDocument()
    await screen.findByRole('group', { name: 'Pilih periode' })
    expect(screen.getByRole('button', { name: 'Bulan ini' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows an honest empty state when the period has no activity', async () => {
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    expect(await screen.findByText('Belum ada transaksi atau pembelian stok pada periode ini.')).toBeInTheDocument()
  })

  it('leads with laba kotor, then penjualan, belanja stok and arus kas', async () => {
    await seedKatalog(); await seedBatch(); await seedSale('s1', [line()], 100_000)
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    expect(await screen.findByText('Laba kotor bulan ini')).toBeInTheDocument()
    expect(screen.getByText('40.000')).toBeInTheDocument()
    expect(screen.getByText(/Semua 1 baris punya harga beli\./)).toBeInTheDocument()
    expect(screen.getByText(/Belum ada biaya operasional tercatat/)).toBeInTheDocument()
    const rows = screen.getByRole('list', { name: 'Ringkasan angka' })
    expect(within(rows).getByText('Penjualan')).toBeInTheDocument()
    expect(within(rows).getByText('Belanja stok')).toBeInTheDocument()
    expect(within(rows).getByText('Arus kas')).toBeInTheDocument()
    expect(within(rows).getByText(/1 transaksi/)).toBeInTheDocument()
  })

  it('shows a dash and the reason when no line has a harga beli, never 0', async () => {
    await seedKatalog(); await seedSale('s1', [line({ batchId: undefined })], 100_000)
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    expect(await screen.findByLabelText('Belum diketahui')).toBeInTheDocument()
    expect(screen.getByText(/Harga beli belum tercatat, laba belum bisa dihitung\./)).toBeInTheDocument()
  })

  it('states partial coverage', async () => {
    await seedKatalog(); await seedBatch()
    await seedSale('s1', [line(), line({ batchId: undefined })], 200_000)
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    expect(await screen.findByText(/1 dari 2 baris punya harga beli\. Laba hanya dari baris tersebut\./)).toBeInTheDocument()
  })

  it('flags arus kas as incomplete when a pembelian has no harga beli', async () => {
    await seedKatalog(); await seedBatch({ batchId: 'b-x', hargaBeli: undefined }); await seedSale('s1', [line({ batchId: undefined })], 100_000)
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    expect(await screen.findByText('1 pembelian belum punya harga beli, jadi belanja stok sebenarnya lebih besar.')).toBeInTheDocument()
  })

  it('lists margin per kategori and the top barang', async () => {
    await seedKatalog(); await seedBatch(); await seedSale('s1', [line()], 100_000)
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    const kat = await screen.findByRole('list', { name: 'Margin per kategori' })
    expect(within(kat).getByText('Semen')).toBeInTheDocument()
    expect(within(kat).getByText(/margin 40%/)).toBeInTheDocument()
    const top = screen.getByRole('list', { name: 'Barang terlaris' })
    expect(within(top).getByText('Semen')).toBeInTheDocument()
    expect(within(top).getByText('1 sak')).toBeInTheDocument()
  })

  it('does not count a voided sale', async () => {
    await seedKatalog(); await seedSale('s1', [line()], 100_000, { status: 'batal' })
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    expect(await screen.findByText(/Belum ada transaksi/)).toBeInTheDocument()
  })

  describe('the period control', () => {
    const hariIni = () => todayIsoDate(systemClock)
    const awalBulanIni = () => `${hariIni().slice(0, 8)}01`
    const prev = () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1, 12)
    const pad = (n: number) => String(n).padStart(2, '0')
    const hariBulanLalu = (d: number) => `${prev().getFullYear()}-${pad(prev().getMonth() + 1)}-${pad(d)}`
    const rentangField = () => screen.getByRole('button', { name: /Rentang tanggal/ })

    it('offers only Hari ini, Bulan ini and Tahun ini as shortcuts, Bulan ini chosen', async () => {
      render(<MemoryRouter><Laporan /></MemoryRouter>)
      const group = await screen.findByRole('group', { name: 'Pilih periode' })
      expect(within(group).getAllByRole('button').map(b => b.textContent)).toEqual(['Hari ini', 'Bulan ini', 'Tahun ini'])
      expect(within(group).getByRole('button', { name: 'Bulan ini' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('always shows the range being reported, starting at this month', async () => {
      render(<MemoryRouter><Laporan /></MemoryRouter>)
      await screen.findByRole('group', { name: 'Pilih periode' })
      expect(rentangField()).toHaveTextContent(`${ringkas(awalBulanIni())} → ${ringkas(hariIni())}`)
    })

    it('a shortcut fills the range and re-queries: a sale made today is in Hari ini and Tahun ini', async () => {
      await seedKatalog(); await seedBatch(); await seedSale('s1', [line()], 100_000)
      render(<MemoryRouter><Laporan /></MemoryRouter>)
      await screen.findByText('Laba kotor bulan ini')
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Tahun ini' }))
      expect(await screen.findByText('Laba kotor tahun ini')).toBeInTheDocument()
      expect(rentangField()).toHaveTextContent(`${ringkas(`${hariIni().slice(0, 4)}-01-01`)} → ${ringkas(hariIni())}`)
      expect(screen.getByText('40.000')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Hari ini' }))
      expect(await screen.findByText('Laba kotor hari ini')).toBeInTheDocument()
      expect(rentangField()).toHaveTextContent(`${ringkas(hariIni())} → ${ringkas(hariIni())}`)
      expect(screen.getByText('40.000')).toBeInTheDocument()
    })

    it('a range picked by hand is reported, and no shortcut stays pressed', async () => {
      await seedKatalog(); await seedBatch()
      await seedSale('s-in', [line()], 100_000, { occurredAt: new Date(prev().getFullYear(), prev().getMonth(), 10, 10).toISOString() })
      await seedSale('s-out', [line()], 100_000, { occurredAt: new Date(prev().getFullYear(), prev().getMonth(), 20, 10).toISOString() })
      render(<MemoryRouter><Laporan /></MemoryRouter>)
      await screen.findByText('Laba kotor bulan ini')

      await pilihRentang(userEvent.setup(), /Rentang tanggal/, hariBulanLalu(9), hariBulanLalu(12))

      expect(await screen.findByText(new RegExp(`Laba kotor ${ringkas(hariBulanLalu(9))} – ${ringkas(hariBulanLalu(12))}`))).toBeInTheDocument()
      expect(rentangField()).toHaveTextContent(`${ringkas(hariBulanLalu(9))} → ${ringkas(hariBulanLalu(12))}`)
      // The title follows the picked dates at once; the figures follow once the query resolves, so wait for them.
      expect(await within(await screen.findByRole('list', { name: 'Ringkasan angka' })).findByText(/1 transaksi/)).toBeInTheDocument()
      expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    })

    it('a range that equals a shortcut lights that shortcut and is titled like it', async () => {
      await seedKatalog(); await seedBatch(); await seedSale('s1', [line()], 100_000)
      render(<MemoryRouter><Laporan /></MemoryRouter>)
      await screen.findByText('Laba kotor bulan ini')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Hari ini' }))
      await screen.findByText('Laba kotor hari ini')

      await pilihRentang(user, /Rentang tanggal/, awalBulanIni(), hariIni())

      const lit = screen.getAllByRole('button', { pressed: true })
      expect(lit).toHaveLength(1)
      // On the 1st of the month "Hari ini" and "Bulan ini" are the same range; either title is right then.
      expect(['Hari ini', 'Bulan ini']).toContain(lit[0].textContent)
      expect(await screen.findByText(/Laba kotor (bulan ini|hari ini)/)).toBeInTheDocument()
    })

    it('a one-day range is titled with that single date', async () => {
      render(<MemoryRouter><Laporan /></MemoryRouter>)
      await screen.findByRole('group', { name: 'Pilih periode' })
      await pilihRentang(userEvent.setup(), /Rentang tanggal/, hariBulanLalu(9), hariBulanLalu(9))
      expect((await screen.findAllByText(new RegExp(ringkas(hariBulanLalu(9))))).length).toBeGreaterThan(0)
      expect(screen.queryByText(new RegExp(`${ringkas(hariBulanLalu(9))} – ${ringkas(hariBulanLalu(9))}`))).toBeNull()
    })

    it('cannot pick a day after today, or turn to a month after this one', async () => {
      render(<MemoryRouter><Laporan /></MemoryRouter>)
      await screen.findByRole('group', { name: 'Pilih periode' })
      const kartu = await bukaKalender(userEvent.setup(), /Rentang tanggal/)
      expect(within(kartu).getByRole('button', { name: 'Bulan berikutnya' })).toBeDisabled()
      expect(within(kartu).getByRole('button', { name: 'Tahun berikutnya' })).toBeDisabled()
    })
  })

  it('shows no delta badge when the previous period has no positive laba', async () => {
    await seedKatalog(); await seedBatch(); await seedSale('s1', [line()], 100_000)
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    await screen.findByText('Laba kotor bulan ini')
    expect(screen.queryByText(/dari periode sebelumnya/)).not.toBeInTheDocument()
  })

  it('arus kas counts the money that came in, not a Bon that is still owed', async () => {
    await seedKatalog(); await seedBatch()
    await seedSale('s-bon', [line()], 100_000, { metodeBayar: 'bon', customerId: 'c1', jatuhTempo: '2099-01-01', dibayarAwal: 20_000 })
    render(<MemoryRouter><Laporan /></MemoryRouter>)

    const rows = await screen.findByRole('list', { name: 'Ringkasan angka' })
    expect(within(rows).getByText('Uang masuk Rp 20.000 dikurangi belanja stok.')).toBeInTheDocument()
    // penjualan 100.000 (the Bon is sold) vs arus kas 20.000 - 600.000 (cash actually in, less the purchase)
    expect(within(rows).getByText('− 580.000')).toBeInTheDocument()
  })

  it('does not call a period empty when the only activity is a Bon payment', async () => {
    await db.paymentsProj.put({ id: 'p1', saleId: 'bon-lama', jumlah: 1_000_000, occurredAt: now(), recordedAt: now(), deviceId: 'd1' })
    render(<MemoryRouter><Laporan /></MemoryRouter>)

    const rows = await screen.findByRole('list', { name: 'Ringkasan angka' })
    expect(within(rows).getByText('Uang masuk Rp 1.000.000 dikurangi belanja stok.')).toBeInTheDocument()
    expect(screen.queryByText('Belum ada transaksi atau pembelian stok pada periode ini.')).toBeNull()
  })
})

describe('Laporan: biaya operasional', () => {
  const seedBiaya = (id: string, jumlah: number, kategori: 'gaji' | 'listrik', over: { occurredAt?: string; status?: 'aktif' | 'batal' } = {}) =>
    db.expensesProj.put({ id, jumlah, kategori, occurredAt: over.occurredAt ?? now(), recordedAt: now(), deviceId: 'd1', status: over.status ?? 'aktif' })

  it('without any expense, says so and links to where to record one', async () => {
    await seedKatalog(); await seedBatch(); await seedSale('s1', [line()], 100_000)
    render(<MemoryRouter><Laporan /></MemoryRouter>)

    expect(await screen.findByText(/Belum ada biaya operasional tercatat/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Catat biaya' })).toHaveAttribute('href', '/biaya')
    expect(screen.queryByText(/Laba bersih/)).toBeNull()
  })

  it('shows biaya operasional, laba bersih and a per-kategori breakdown once expenses exist', async () => {
    await seedKatalog(); await seedBatch(); await seedSale('s1', [line()], 100_000)
    await seedBiaya('b-gaji', 25_000, 'gaji'); await seedBiaya('b-listrik', 5_000, 'listrik')
    await seedBiaya('b-batal', 9_999, 'gaji', { status: 'batal' })
    render(<MemoryRouter><Laporan /></MemoryRouter>)

    expect(await screen.findByText('Laba bersih bulan ini')).toBeInTheDocument()
    // 100.000 sale - 60.000 cost = 40.000 laba kotor; - 30.000 expenses = 10.000
    const bersih = screen.getByText('Laba bersih bulan ini').closest('section') as HTMLElement
    expect(within(bersih).getByText('10.000')).toBeInTheDocument()
    expect(screen.queryByText(/Belum dikurangi biaya operasional/)).toBeNull()

    const rows = screen.getByRole('list', { name: 'Ringkasan angka' })
    expect(within(rows).getByText('Biaya operasional')).toBeInTheDocument()
    expect(within(rows).getByText('30.000')).toBeInTheDocument()

    const perKategori = screen.getByRole('list', { name: 'Biaya per kategori' })
    const items = within(perKategori).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Gaji')
    expect(items[0]).toHaveTextContent('25.000')
    expect(items[1]).toHaveTextContent('Listrik')
  })

  it('shows a dash for laba bersih when laba kotor is unknown, never a guessed profit', async () => {
    await seedKatalog(); await seedBatch({ hargaBeli: undefined }); await seedSale('s1', [line()], 100_000)
    await seedBiaya('b1', 5_000, 'gaji')
    render(<MemoryRouter><Laporan /></MemoryRouter>)

    const bersih = (await screen.findByText('Laba bersih bulan ini')).closest('section') as HTMLElement
    expect(within(bersih).getByLabelText('Belum diketahui')).toBeInTheDocument()
  })

  it('does not call a period empty when its only activity is an expense', async () => {
    await seedBiaya('b1', 5_000, 'gaji')
    render(<MemoryRouter><Laporan /></MemoryRouter>)

    expect(await screen.findByRole('list', { name: 'Ringkasan angka' })).toBeInTheDocument()
    expect(screen.queryByText('Belum ada transaksi atau pembelian stok pada periode ini.')).toBeNull()
  })
})

describe('Laporan: uang masuk per metode', () => {
  it('splits the money in by Tunai, Transfer, QRIS and Bon once more than one way was used', async () => {
    await seedKatalog(); await seedBatch()
    await seedSale('s1', [line()], 100_000)
    await seedSale('s2', [line()], 200_000, { metodeBayar: 'transfer' })
    await seedSale('s3', [line()], 100_000, { metodeBayar: 'bon', customerId: 'c1', jatuhTempo: '2099-01-01', dibayarAwal: 30_000 })
    render(<MemoryRouter><Laporan /></MemoryRouter>)

    const list = await screen.findByRole('list', { name: 'Uang masuk per metode' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Tunai')
    expect(rows[0]).toHaveTextContent('100.000')
    expect(rows[1]).toHaveTextContent('Transfer')
    expect(rows[1]).toHaveTextContent('200.000')
    expect(rows[2]).toHaveTextContent('Bon')
    expect(rows[2]).toHaveTextContent('30.000')
  })

  it('is not shown when everything came in one way', async () => {
    await seedKatalog(); await seedBatch(); await seedSale('s1', [line()], 100_000)
    render(<MemoryRouter><Laporan /></MemoryRouter>)
    await screen.findByRole('list', { name: 'Ringkasan angka' })
    expect(screen.queryByRole('list', { name: 'Uang masuk per metode' })).toBeNull()
  })
})
