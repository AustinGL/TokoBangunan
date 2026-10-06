import { describe, it, expect } from 'vitest'
import {
  rentangLaporan, hariDalam, dalamRentang, presetUntuk, summarizeLaporan, kategoriNamaPerItem, TANPA_KATEGORI,
  type LaporanSale, type LaporanBatch, type LaporanExpense,
} from './laporan'
import type { Item } from './projections/items'
import type { Barang } from './projections/barang'
import type { KategoriEntry } from './kategori'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 10, 0, 0)

describe('rentangLaporan', () => {
  it('hari-ini is today, previous is yesterday', () => {
    expect(rentangLaporan('hari-ini', d(2026, 10, 3))).toEqual({
      sekarang: { from: '2026-10-03', to: '2026-10-03' },
      sebelumnya: { from: '2026-10-02', to: '2026-10-02' },
    })
  })

  it('bulan-ini runs from the 1st to today, previous covers the same elapsed days of last month', () => {
    expect(rentangLaporan('bulan-ini', d(2026, 10, 15))).toEqual({
      sekarang: { from: '2026-10-01', to: '2026-10-15' },
      sebelumnya: { from: '2026-09-01', to: '2026-09-15' },
    })
  })

  it('bulan-ini on the 31st clamps the previous period to the last day of last month', () => {
    expect(rentangLaporan('bulan-ini', d(2026, 10, 31)).sebelumnya).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('bulan-ini in January compares with December of the previous year', () => {
    expect(rentangLaporan('bulan-ini', d(2027, 1, 10))).toEqual({
      sekarang: { from: '2027-01-01', to: '2027-01-10' },
      sebelumnya: { from: '2026-12-01', to: '2026-12-10' },
    })
  })

  it('tahun-ini runs from 1 January to today, previous is the same elapsed span of last year', () => {
    expect(rentangLaporan('tahun-ini', d(2026, 10, 3))).toEqual({
      sekarang: { from: '2026-01-01', to: '2026-10-03' },
      sebelumnya: { from: '2025-01-01', to: '2025-10-03' },
    })
  })

  it('tahun-ini on 29 February clamps the previous year to 28 February', () => {
    expect(rentangLaporan('tahun-ini', d(2028, 2, 29)).sebelumnya).toEqual({ from: '2027-01-01', to: '2027-02-28' })
  })

  it('a custom range is used as given, previous is the equal-length range right before it', () => {
    expect(rentangLaporan({ from: '2026-10-10', to: '2026-10-14' }, d(2026, 10, 20))).toEqual({
      sekarang: { from: '2026-10-10', to: '2026-10-14' },
      sebelumnya: { from: '2026-10-05', to: '2026-10-09' },
    })
  })

  it('a custom previous range crosses a month and year boundary', () => {
    expect(rentangLaporan({ from: '2027-01-02', to: '2027-01-04' }, d(2027, 1, 20)).sebelumnya).toEqual({ from: '2026-12-30', to: '2027-01-01' })
  })

  it('a one-day custom range compares with the day before', () => {
    expect(rentangLaporan({ from: '2026-10-10', to: '2026-10-10' }, d(2026, 10, 20)).sebelumnya).toEqual({ from: '2026-10-09', to: '2026-10-09' })
  })
})

describe('hariDalam / dalamRentang', () => {
  it('lists every day key inclusive, oldest first, across a month boundary', () => {
    expect(hariDalam({ from: '2026-09-29', to: '2026-10-02' })).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
  })

  it('dalamRentang is inclusive on both ends', () => {
    const r = { from: '2026-10-01', to: '2026-10-03' }
    expect(dalamRentang('2026-09-30', r)).toBe(false)
    expect(dalamRentang('2026-10-01', r)).toBe(true)
    expect(dalamRentang('2026-10-03', r)).toBe(true)
    expect(dalamRentang('2026-10-04', r)).toBe(false)
  })
})

const R = { from: '2026-10-01', to: '2026-10-03' }
const at = (day: number, hour = 9) => new Date(2026, 9, day, hour, 0, 0).toISOString()

const sale = (over: Partial<LaporanSale> & Pick<LaporanSale, 'occurredAt'>): LaporanSale => ({
  status: 'aktif', total: 100_000,
  lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', batchId: 'b1', qty: 1000, hargaSatuan: 100_000, subtotal: 100_000 }],
  ...over,
})
const batch = (over: Partial<LaporanBatch> = {}): LaporanBatch => ({
  batchId: 'b1', hargaBeli: 60_000, tanggalBeli: at(1), diterima: 10_000, ...over,
})
const kat = (id: string) => (id === 'semen' ? 'Semen' : id === 'cat' ? 'Cat' : undefined)

describe('summarizeLaporan', () => {
  it('is all zero and null for an empty period', () => {
    const s = summarizeLaporan([], [], kat, R)
    expect(s).toMatchObject({
      penjualan: 0, jumlahTransaksi: 0, labaKotor: null, barisTotal: 0, belanjaStok: 0, arusKas: 0, arusKasLengkap: true,
      perKategori: [], terlaris: [],
    })
    expect(s.perHari.map(h => h.hari)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
  })

  it('totals penjualan and laba kotor for sales inside the range', () => {
    const s = summarizeLaporan([sale({ occurredAt: at(2) }), sale({ occurredAt: at(3), total: 200_000, lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', batchId: 'b1', qty: 2000, hargaSatuan: 100_000, subtotal: 200_000 }] })], [batch()], kat, R)
    expect(s.penjualan).toBe(300_000)
    expect(s.jumlahTransaksi).toBe(2)
    expect(s.labaKotor).toBe(120_000) // (100k-60k)*1 + (100k-60k)*2
    expect(s.barisDenganModal).toBe(2)
    expect(s.barisTotal).toBe(2)
  })

  it('excludes voided sales and sales outside the range', () => {
    const s = summarizeLaporan([
      sale({ occurredAt: at(2), status: 'batal' }),
      sale({ occurredAt: new Date(2026, 8, 30, 12).toISOString() }),
      sale({ occurredAt: new Date(2026, 9, 4, 0, 30).toISOString() }),
    ], [batch()], kat, R)
    expect(s.jumlahTransaksi).toBe(0)
    expect(s.penjualan).toBe(0)
  })

  it('buckets by local day: 23:30 on the last day is in, 00:30 the next day is out', () => {
    const inside = sale({ occurredAt: new Date(2026, 9, 3, 23, 30).toISOString() })
    const outside = sale({ occurredAt: new Date(2026, 9, 4, 0, 30).toISOString() })
    expect(summarizeLaporan([inside, outside], [batch()], kat, R).jumlahTransaksi).toBe(1)
  })

  it('reports laba only over lines with a known cost and states the coverage', () => {
    const s = summarizeLaporan([sale({
      occurredAt: at(2), total: 300_000,
      lines: [
        { itemId: 'semen', nama: 'Semen', unit: 'sak', batchId: 'b1', qty: 1000, hargaSatuan: 100_000, subtotal: 100_000 },
        { itemId: 'cat', nama: 'Cat', unit: 'kaleng', batchId: undefined, qty: 1000, hargaSatuan: 100_000, subtotal: 100_000 },
        { itemId: 'cat', nama: 'Cat', unit: 'kaleng', batchId: 'b-no-cost', qty: 1000, hargaSatuan: 100_000, subtotal: 100_000 },
      ],
    })], [batch(), batch({ batchId: 'b-no-cost', hargaBeli: undefined, tanggalBeli: at(1) })], kat, R)
    expect(s.labaKotor).toBe(40_000)
    expect(s.barisDenganModal).toBe(1)
    expect(s.barisTotal).toBe(3)
  })

  it('returns null laba (never 0) when no line has a known cost', () => {
    const s = summarizeLaporan([sale({ occurredAt: at(2), lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 100_000, subtotal: 100_000 }] })], [], kat, R)
    expect(s.labaKotor).toBeNull()
    expect(s.penjualan).toBe(100_000)
  })

  it('honours a price override: laba uses the actual hargaSatuan', () => {
    const s = summarizeLaporan([sale({ occurredAt: at(2), lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', batchId: 'b1', qty: 1000, hargaSatuan: 55_000, subtotal: 55_000 }] })], [batch()], kat, R)
    expect(s.labaKotor).toBe(-5_000)
  })

  it('belanja stok sums hargaBeli x diterima for batches bought in the range only', () => {
    const s = summarizeLaporan([], [
      batch({ batchId: 'in', tanggalBeli: at(2), diterima: 10_000, hargaBeli: 60_000 }),
      batch({ batchId: 'out', tanggalBeli: new Date(2026, 8, 20).toISOString(), diterima: 10_000, hargaBeli: 60_000 }),
    ], kat, R)
    expect(s.belanjaStok).toBe(600_000)
    expect(s.batchTotal).toBe(1)
    expect(s.batchTanpaHarga).toBe(0)
    expect(s.arusKas).toBe(-600_000)
    expect(s.arusKasLengkap).toBe(true)
  })

  it('a batch without hargaBeli is counted, never treated as cost 0, and flags arus kas incomplete', () => {
    const s = summarizeLaporan([sale({ occurredAt: at(2) })], [batch({ batchId: 'x', hargaBeli: undefined, tanggalBeli: at(2) })], kat, R)
    expect(s.batchTanpaHarga).toBe(1)
    expect(s.batchTotal).toBe(1)
    expect(s.belanjaStok).toBe(0)
    expect(s.arusKasLengkap).toBe(false)
    expect(s.arusKas).toBe(100_000)
  })

  it('groups per kategori with margin over covered lines, sorted by penjualan, with a Tanpa kategori fallback', () => {
    const s = summarizeLaporan([sale({
      occurredAt: at(2), total: 350_000,
      lines: [
        { itemId: 'semen', nama: 'Semen', unit: 'sak', batchId: 'b1', qty: 1000, hargaSatuan: 100_000, subtotal: 100_000 },
        { itemId: 'cat', nama: 'Cat', unit: 'kaleng', batchId: undefined, qty: 1000, hargaSatuan: 200_000, subtotal: 200_000 },
        { itemId: 'ghost', nama: 'Hantu', unit: 'pcs', batchId: undefined, qty: 1000, hargaSatuan: 50_000, subtotal: 50_000 },
      ],
    })], [batch()], kat, R)
    expect(s.perKategori.map(k => k.kategori)).toEqual(['Cat', 'Semen', TANPA_KATEGORI])
    const semen = s.perKategori.find(k => k.kategori === 'Semen')!
    expect(semen).toMatchObject({ penjualan: 100_000, laba: 40_000, margin: 40, barisDenganModal: 1, barisTotal: 1 })
    const cat = s.perKategori.find(k => k.kategori === 'Cat')!
    expect(cat).toMatchObject({ penjualan: 200_000, laba: null, margin: null, barisDenganModal: 0, barisTotal: 1 })
  })

  it('lists the top five barang by penjualan, merging lines of the same item', () => {
    const lines = (itemId: string, subtotal: number) => ({ itemId, nama: itemId, unit: 'pcs', qty: 1000, hargaSatuan: subtotal, subtotal })
    const s = summarizeLaporan([
      sale({ occurredAt: at(2), total: 0, lines: [lines('a', 10), lines('b', 20), lines('c', 30), lines('d', 40), lines('e', 50), lines('f', 5), lines('a', 100)] }),
    ], [], kat, R)
    expect(s.terlaris.map(t => t.itemId)).toEqual(['a', 'e', 'd', 'c', 'b'])
    expect(s.terlaris[0]).toMatchObject({ penjualan: 110, qty: 2000 })
  })

  it('builds a daily series covering every day of the range, zero where nothing sold', () => {
    const s = summarizeLaporan([sale({ occurredAt: at(1), total: 10 }), sale({ occurredAt: at(3), total: 30 }), sale({ occurredAt: at(3, 15), total: 5 })], [], kat, R)
    expect(s.perHari).toEqual([
      { hari: '2026-10-01', penjualan: 10 }, { hari: '2026-10-02', penjualan: 0 }, { hari: '2026-10-03', penjualan: 35 },
    ])
  })
})

describe('kategoriNamaPerItem', () => {
  const stamp = { updatedAt: 't', updatedByEventId: 'e' }
  const item = (id: string, over: Partial<Item> = {}): Item => ({
    id, nama: id, baseUnit: 'sak', units: [{ unit: 'sak', factor: 1 }], hargaEceran: 1, stokMinimum: 0, diarsipkan: false, ...stamp, ...over,
  })
  const barang = (id: string, over: Partial<Barang> = {}): Barang => ({ id, nama: id, diarsipkan: false, ...stamp, ...over } as Barang)
  const entries: KategoriEntry[] = [{ id: 'k1', nama: 'Semen', diarsipkan: false, materialized: true }]

  it('resolves through the barang when the item has one', () => {
    const of = kategoriNamaPerItem([item('u1', { barangId: 'b1' })], [barang('b1', { kategoriId: 'k1' })], entries)
    expect(of('u1')).toBe('Semen')
  })

  it('falls back to the own legacy kategori text of the item when it has no barang', () => {
    const of = kategoriNamaPerItem([item('u2', { kategori: 'Cat Lama' })], [], [])
    expect(of('u2')).toBe('Cat Lama')
  })

  it('is undefined for an unknown item or one with no kategori', () => {
    const of = kategoriNamaPerItem([item('u3')], [], entries)
    expect(of('u3')).toBeUndefined()
    expect(of('missing')).toBeUndefined()
  })

  it('uses the own text of the item when its barang row is not on this device', () => {
    const of = kategoriNamaPerItem([item('u4', { barangId: 'gone', kategori: 'Pasir' })], [], [])
    expect(of('u4')).toBe('Pasir')
  })
})

describe('summarizeLaporan: uang masuk with Bon', () => {
  const bonSale = (over: Partial<LaporanSale> & Pick<LaporanSale, 'occurredAt'>): LaporanSale => sale({ metodeBayar: 'bon', dibayarAwal: 0, ...over })

  it('a Bon counts as penjualan but only its down payment is uang masuk', () => {
    const s = summarizeLaporan([bonSale({ occurredAt: at(2), dibayarAwal: 20_000 })], [], kat, R)
    expect(s.penjualan).toBe(100_000)
    expect(s.uangMasuk).toBe(20_000)
    expect(s.arusKas).toBe(20_000)
  })

  it('a Bon with no down payment brings in nothing yet', () => {
    const s = summarizeLaporan([bonSale({ occurredAt: at(2) })], [], kat, R)
    expect(s.penjualan).toBe(100_000)
    expect(s.uangMasuk).toBe(0)
  })

  it('a payment received inside the range is uang masuk, even for a Bon sold before the range', () => {
    const payments = [{ saleId: 'lama', jumlah: 30_000, occurredAt: at(2) }]
    const s = summarizeLaporan([], [], kat, R, payments)
    expect(s.uangMasuk).toBe(30_000)
    expect(s.penjualan).toBe(0)
    expect(s.arusKas).toBe(30_000)
  })

  it('a payment outside the range is not counted', () => {
    const payments = [
      { saleId: 'a', jumlah: 30_000, occurredAt: new Date(2026, 8, 30, 12).toISOString() },
      { saleId: 'b', jumlah: 40_000, occurredAt: new Date(2026, 9, 4, 0, 30).toISOString() },
    ]
    expect(summarizeLaporan([], [], kat, R, payments).uangMasuk).toBe(0)
  })

  it('tunai sales count in full, a voided Bon counts nothing, and belanja stok is still subtracted', () => {
    const s = summarizeLaporan([
      sale({ occurredAt: at(1) }),                                              // tunai, 100.000
      bonSale({ occurredAt: at(2), dibayarAwal: 25_000 }),                      // 25.000 in
      bonSale({ occurredAt: at(2), dibayarAwal: 25_000, status: 'batal' }),     // void: nothing
    ], [batch({ tanggalBeli: at(1), diterima: 1_000, hargaBeli: 40_000 })], kat, R, [{ saleId: 'x', jumlah: 10_000, occurredAt: at(3) }])
    expect(s.uangMasuk).toBe(135_000)
    expect(s.belanjaStok).toBe(40_000)
    expect(s.arusKas).toBe(95_000)
  })

  it('a sale with no metodeBayar (older rows) is treated as tunai', () => {
    expect(summarizeLaporan([sale({ occurredAt: at(2) })], [], kat, R).uangMasuk).toBe(100_000)
  })
})

describe('presetUntuk', () => {
  const now = new Date(2026, 9, 3, 10)

  it('names the preset whose range a range equals', () => {
    expect(presetUntuk({ from: '2026-10-03', to: '2026-10-03' }, now)).toBe('hari-ini')
    expect(presetUntuk({ from: '2026-10-01', to: '2026-10-03' }, now)).toBe('bulan-ini')
    expect(presetUntuk({ from: '2026-01-01', to: '2026-10-03' }, now)).toBe('tahun-ini')
  })

  it('is null for any other range', () => {
    expect(presetUntuk({ from: '2026-10-02', to: '2026-10-03' }, now)).toBeNull()
    expect(presetUntuk({ from: '2026-09-01', to: '2026-09-30' }, now)).toBeNull()
  })

  it('prefers hari-ini, then bulan-ini, when ranges coincide (the 1st of a month)', () => {
    expect(presetUntuk({ from: '2026-10-01', to: '2026-10-01' }, new Date(2026, 9, 1, 10))).toBe('hari-ini')
    expect(presetUntuk({ from: '2026-01-01', to: '2026-01-01' }, new Date(2026, 0, 1, 10))).toBe('hari-ini')
  })
})

describe('summarizeLaporan: biaya operasional', () => {
  const biaya = (over: Partial<LaporanExpense> & Pick<LaporanExpense, 'occurredAt'>): LaporanExpense => ({
    status: 'aktif', jumlah: 10_000, kategori: 'lainnya', ...over,
  })
  // One sale of 100.000 on a batch costing 60.000/unit-base: laba kotor 40.000 (see the fixtures above).
  const jual = [sale({ occurredAt: at(2) })]

  it('subtracts the expenses in the range from laba kotor to get laba bersih', () => {
    const s = summarizeLaporan(jual, [batch({ tanggalBeli: at(1, 8) })], kat, R, [], [
      biaya({ occurredAt: at(2), jumlah: 5_000, kategori: 'listrik' }),
      biaya({ occurredAt: at(3), jumlah: 3_000, kategori: 'listrik' }),
      biaya({ occurredAt: at(3), jumlah: 2_000, kategori: 'gaji' }),
    ])
    expect(s.labaKotor).toBe(40_000)
    expect(s.biayaOperasional).toBe(10_000)
    expect(s.labaBersih).toBe(30_000)
  })

  it('ignores voided expenses and ones outside the range', () => {
    const s = summarizeLaporan(jual, [batch()], kat, R, [], [
      biaya({ occurredAt: at(2), jumlah: 5_000, status: 'batal' }),
      biaya({ occurredAt: new Date(2026, 8, 30, 10).toISOString(), jumlah: 7_000 }),
      biaya({ occurredAt: new Date(2026, 9, 4, 10).toISOString(), jumlah: 9_000 }),
    ])
    expect(s.biayaOperasional).toBe(0)
    expect(s.labaBersih).toBe(40_000)
  })

  it('totals expenses per kategori, biggest first', () => {
    const s = summarizeLaporan([], [], kat, R, [], [
      biaya({ occurredAt: at(2), jumlah: 3_000, kategori: 'listrik' }),
      biaya({ occurredAt: at(2), jumlah: 9_000, kategori: 'gaji' }),
      biaya({ occurredAt: at(3), jumlah: 4_000, kategori: 'listrik' }),
    ])
    expect(s.biayaPerKategori).toEqual([{ kategori: 'gaji', jumlah: 9_000 }, { kategori: 'listrik', jumlah: 7_000 }])
  })

  it('takes expenses out of arus kas, together with belanja stok', () => {
    const s = summarizeLaporan(jual, [batch({ tanggalBeli: at(1) })], kat, R, [], [biaya({ occurredAt: at(2), jumlah: 25_000 })])
    // 100.000 in, 600.000 of stock bought (60.000 x 10_000 base / 1000), 25.000 of expenses
    expect(s.arusKas).toBe(s.uangMasuk - s.belanjaStok - 25_000)
  })

  it('has no laba bersih when laba kotor is unknown, never a guessed one, but still counts the expense', () => {
    const s = summarizeLaporan([sale({ occurredAt: at(2), lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 100_000, subtotal: 100_000 }] })], [], kat, R, [], [biaya({ occurredAt: at(2), jumlah: 5_000 })])
    expect(s.labaKotor).toBeNull()
    expect(s.labaBersih).toBeNull()
    expect(s.biayaOperasional).toBe(5_000)
  })

  it('a period with only expenses has laba kotor unknown and a negative arus kas', () => {
    const s = summarizeLaporan([], [], kat, R, [], [biaya({ occurredAt: at(2), jumlah: 5_000 })])
    expect(s.arusKas).toBe(-5_000)
  })

  it('defaults to no expenses: existing callers keep their numbers', () => {
    const s = summarizeLaporan(jual, [batch()], kat, R)
    expect(s.biayaOperasional).toBe(0)
    expect(s.labaBersih).toBe(s.labaKotor)
  })
})

describe('summarizeLaporan: Transfer and QRIS', () => {
  it('count in full as penjualan and as uang masuk, like a cash sale', () => {
    const s = summarizeLaporan([
      sale({ occurredAt: at(2), metodeBayar: 'transfer' }),
      sale({ occurredAt: at(2), metodeBayar: 'qris' }),
    ], [], kat, R)
    expect(s.penjualan).toBe(200_000)
    expect(s.uangMasuk).toBe(200_000)
  })
})

describe('summarizeLaporan: uang masuk per metode', () => {
  it('splits money in by how it came: tunai, transfer, QRIS and Bon money', () => {
    const s = summarizeLaporan([
      sale({ occurredAt: at(2), metodeBayar: 'tunai', total: 100_000 }),
      sale({ occurredAt: at(2), metodeBayar: 'transfer', total: 200_000 }),
      sale({ occurredAt: at(3), metodeBayar: 'qris', total: 50_000 }),
      sale({ occurredAt: at(3), metodeBayar: 'bon', total: 90_000, dibayarAwal: 10_000 }),
    ], [], kat, R, [{ saleId: 'lama', jumlah: 25_000, occurredAt: at(2) }])
    expect(s.uangMasukPerMetode).toEqual([
      { metode: 'tunai', jumlah: 100_000 },
      { metode: 'transfer', jumlah: 200_000 },
      { metode: 'qris', jumlah: 50_000 },
      { metode: 'bon', jumlah: 35_000 },
    ])
    expect(s.uangMasukPerMetode.reduce((sum, m) => sum + m.jumlah, 0)).toBe(s.uangMasuk)
  })

  it('treats an old row with no metode as tunai and leaves out methods with nothing', () => {
    const s = summarizeLaporan([sale({ occurredAt: at(2), total: 70_000 })], [], kat, R)
    expect(s.uangMasukPerMetode).toEqual([{ metode: 'tunai', jumlah: 70_000 }])
  })

  it('is empty when no money came in', () => {
    expect(summarizeLaporan([], [], kat, R).uangMasukPerMetode).toEqual([])
  })
})
