import { localDayKey } from './dashboard'
import { laba } from './laba'
import { resolveKategori, type KategoriEntry } from './kategori'
import { multiplyByQty, rupiah } from './money'
import type { Barang } from './projections/barang'
import type { Item } from './projections/items'

/**
 * Laporan's pure arithmetic: period ranges, then the summary. "Now" is always
 * passed in; this module never reads the wall clock.
 */

export type LaporanPreset = 'hari-ini' | 'bulan-ini' | 'tahun-ini'

/** Inclusive local-day keys (yyyy-mm-dd). Lexicographic order is chronological order. */
export type Rentang = { from: string; to: string }

/** A one-tap preset, or a custom range picked by hand. */
export type LaporanPilihan = LaporanPreset | Rentang

// Noon, not midnight: a DST shift can never move the calendar day.
const dayAt = (y: number, m: number, day: number): Date => new Date(y, m, day, 12, 0, 0, 0)
const key = (y: number, m: number, day: number): string => localDayKey(dayAt(y, m, day))
const daysInMonth = (y: number, m: number): number => new Date(y, m + 1, 0).getDate()

/** The chosen range and the equal-length range it is compared with. */
export function rentangLaporan(pilihan: LaporanPilihan, now: Date): { sekarang: Rentang; sebelumnya: Rentang } {
  if (typeof pilihan !== 'string') {
    // Custom: the previous range is the same number of days, ending the day before.
    const panjang = hariDalam(pilihan).length
    const [y, m, day] = pilihan.from.split('-').map(Number)
    return {
      sekarang: pilihan,
      sebelumnya: { from: key(y, m - 1, day - panjang), to: key(y, m - 1, day - 1) },
    }
  }

  const y = now.getFullYear()
  const m = now.getMonth()
  const day = now.getDate()

  if (pilihan === 'hari-ini') {
    return {
      sekarang: { from: key(y, m, day), to: key(y, m, day) },
      sebelumnya: { from: key(y, m, day - 1), to: key(y, m, day - 1) },
    }
  }
  if (pilihan === 'tahun-ini') {
    // Same elapsed span of last year, clamped so 29 February never rolls into March.
    return {
      sekarang: { from: key(y, 0, 1), to: key(y, m, day) },
      sebelumnya: { from: key(y - 1, 0, 1), to: key(y - 1, m, Math.min(day, daysInMonth(y - 1, m))) },
    }
  }
  // Date normalises month -1 to December of the previous year.
  const prev = dayAt(y, m - 1, 1)
  const py = prev.getFullYear()
  const pm = prev.getMonth()
  return {
    sekarang: { from: key(y, m, 1), to: key(y, m, day) },
    // Same elapsed days of last month, clamped so the 31st never rolls into this month.
    sebelumnya: { from: key(py, pm, 1), to: key(py, pm, Math.min(day, daysInMonth(py, pm))) },
  }
}

/** The preset whose range equals `rentang`, or null. Earlier presets win when ranges coincide. */
export function presetUntuk(rentang: Rentang, now: Date): LaporanPreset | null {
  for (const preset of ['hari-ini', 'bulan-ini', 'tahun-ini'] as const) {
    const { sekarang } = rentangLaporan(preset, now)
    if (sekarang.from === rentang.from && sekarang.to === rentang.to) return preset
  }
  return null
}

export const dalamRentang = (dayKey: string, r: Rentang): boolean => dayKey >= r.from && dayKey <= r.to

/** Every day key from r.from to r.to inclusive, oldest first. */
export function hariDalam(r: Rentang): string[] {
  const [y, m, day] = r.from.split('-').map(Number)
  const out: string[] = []
  for (let i = 0; ; i += 1) {
    const k = key(y, m - 1, day + i)
    out.push(k)
    if (k >= r.to) return out
  }
}

export type LaporanSale = {
  status: 'aktif' | 'batal'
  total: number
  /** Absent on older rows, which are all tunai. */
  metodeBayar?: 'tunai' | 'bon' | 'transfer' | 'qris'
  /** Bon only: the part paid at the counter. */
  dibayarAwal?: number
  occurredAt: string
  lines: Array<{ itemId: string; nama: string; unit: string; batchId?: string; qty: number; hargaSatuan: number; subtotal: number }>
}
/** A payment received against a Bon nota. */
export type LaporanPayment = { saleId: string; jumlah: number; occurredAt: string }
/** An operating expense (domain/projections/expenses.ts). */
export type LaporanExpense = { status: 'aktif' | 'batal'; jumlah: number; kategori: string; occurredAt: string }
export type LaporanBatch = { batchId: string; hargaBeli?: number; tanggalBeli: string; diterima: number }

export const TANPA_KATEGORI = 'Tanpa kategori'

export type KategoriLaporan = {
  kategori: string
  penjualan: number
  /** Over covered lines only; null when none is covered. */
  laba: number | null
  /** laba / revenue of covered lines, percent to one decimal; null when none is covered. */
  margin: number | null
  barisDenganModal: number
  barisTotal: number
}
/** 'bon' is the money a Bon brought in: down payments and later payments, whatever way they were paid. */
export type MetodeUangMasuk = 'tunai' | 'transfer' | 'qris' | 'bon'
const URUTAN_METODE: MetodeUangMasuk[] = ['tunai', 'transfer', 'qris', 'bon']

export type BarangTerlaris = { itemId: string; nama: string; unit: string; qty: number; penjualan: number }

export type LaporanRingkasan = {
  penjualan: number
  jumlahTransaksi: number
  /** Over the lines whose harga beli is known; null when none is. Never a guessed cost. */
  labaKotor: number | null
  barisDenganModal: number
  barisTotal: number
  belanjaStok: number
  batchTanpaHarga: number
  batchTotal: number
  /**
   * Money that actually came in: tunai sales in full, a Bon's down payment, and
   * every Bon payment received in the range. A Bon is penjualan when it is sold
   * but not uang masuk until it is paid.
   */
  uangMasuk: number
  /** uangMasuk split by how it came; methods with nothing are left out, and the parts add up to uangMasuk. */
  uangMasukPerMetode: Array<{ metode: MetodeUangMasuk; jumlah: number }>
  /** Operating expenses (gaji, sewa, listrik...) paid in the range, voided ones left out. */
  biayaOperasional: number
  biayaPerKategori: Array<{ kategori: string; jumlah: number }>
  /** labaKotor - biayaOperasional; null whenever labaKotor is (never a guessed profit). */
  labaBersih: number | null
  /** uangMasuk - belanjaStok - biayaOperasional. Incomplete (see arusKasLengkap) when a batch has no harga beli. */
  arusKas: number
  arusKasLengkap: boolean
  perKategori: KategoriLaporan[]
  terlaris: BarangTerlaris[]
  perHari: Array<{ hari: string; penjualan: number }>
}

const TOP_TERLARIS = 5

export function summarizeLaporan(
  sales: LaporanSale[],
  batches: LaporanBatch[],
  kategoriOfItem: (itemId: string) => string | undefined,
  rentang: Rentang,
  payments: LaporanPayment[] = [],
  expenses: LaporanExpense[] = [],
): LaporanRingkasan {
  const hargaBeliByBatch = new Map(batches.map(b => [b.batchId, b.hargaBeli]))
  const perHari = new Map(hariDalam(rentang).map(hari => [hari, 0]))
  const perKategori = new Map<string, { penjualan: number; laba: number; modalRevenue: number; dengan: number; total: number }>()
  const terlaris = new Map<string, BarangTerlaris>()

  let penjualan = 0
  let uangMasuk = 0
  const masukPer = new Map<MetodeUangMasuk, number>()
  const masuk = (metode: MetodeUangMasuk, jumlah: number) => {
    uangMasuk += jumlah
    if (jumlah !== 0) masukPer.set(metode, (masukPer.get(metode) ?? 0) + jumlah)
  }
  let jumlahTransaksi = 0
  let labaTotal = 0
  let barisDenganModal = 0
  let barisTotal = 0

  for (const sale of sales) {
    if (sale.status !== 'aktif') continue
    const hari = localDayKey(new Date(sale.occurredAt))
    if (!dalamRentang(hari, rentang)) continue
    penjualan += sale.total
    if (sale.metodeBayar === 'bon') masuk('bon', sale.dibayarAwal ?? 0)
    else masuk(sale.metodeBayar ?? 'tunai', sale.total)
    jumlahTransaksi += 1
    perHari.set(hari, (perHari.get(hari) ?? 0) + sale.total)

    for (const line of sale.lines) {
      const hargaBeli = line.batchId === undefined ? undefined : hargaBeliByBatch.get(line.batchId)
      const l = laba(line.hargaSatuan, hargaBeli, line.qty)
      barisTotal += 1

      const nama = kategoriOfItem(line.itemId) ?? TANPA_KATEGORI
      const k = perKategori.get(nama) ?? { penjualan: 0, laba: 0, modalRevenue: 0, dengan: 0, total: 0 }
      k.penjualan += line.subtotal
      k.total += 1
      if (l !== null) {
        labaTotal += l
        barisDenganModal += 1
        k.laba += l
        k.modalRevenue += line.subtotal
        k.dengan += 1
      }
      perKategori.set(nama, k)

      const t = terlaris.get(line.itemId) ?? { itemId: line.itemId, nama: line.nama, unit: line.unit, qty: 0, penjualan: 0 }
      t.qty += line.qty
      t.penjualan += line.subtotal
      terlaris.set(line.itemId, t)
    }
  }

  // Money received is counted whatever became of the sale: on one device a void is refused once a payment exists, but a void pulled from another device can still land on a paid Bon.
  for (const p of payments) {
    if (dalamRentang(localDayKey(new Date(p.occurredAt)), rentang)) masuk('bon', p.jumlah)
  }

  let belanjaStok = 0
  let batchTotal = 0
  let batchTanpaHarga = 0
  for (const b of batches) {
    if (!dalamRentang(localDayKey(new Date(b.tanggalBeli)), rentang)) continue
    batchTotal += 1
    if (b.hargaBeli === undefined) batchTanpaHarga += 1
    else belanjaStok += multiplyByQty(rupiah(b.hargaBeli), b.diterima)
  }

  const biayaPer = new Map<string, number>()
  let biayaOperasional = 0
  for (const e of expenses) {
    if (e.status !== 'aktif' || !dalamRentang(localDayKey(new Date(e.occurredAt)), rentang)) continue
    biayaOperasional += e.jumlah
    biayaPer.set(e.kategori, (biayaPer.get(e.kategori) ?? 0) + e.jumlah)
  }
  const labaKotor = barisDenganModal === 0 ? null : labaTotal

  return {
    penjualan,
    jumlahTransaksi,
    labaKotor,
    barisDenganModal,
    barisTotal,
    belanjaStok,
    batchTanpaHarga,
    batchTotal,
    uangMasuk,
    uangMasukPerMetode: URUTAN_METODE.filter(m => masukPer.has(m)).map(metode => ({ metode, jumlah: masukPer.get(metode) as number })),
    biayaOperasional,
    biayaPerKategori: [...biayaPer.entries()].map(([kategori, jumlah]) => ({ kategori, jumlah })).sort((a, b) => b.jumlah - a.jumlah),
    labaBersih: labaKotor === null ? null : labaKotor - biayaOperasional,
    arusKas: uangMasuk - belanjaStok - biayaOperasional,
    arusKasLengkap: batchTanpaHarga === 0,
    perKategori: [...perKategori.entries()]
      .map(([kategori, k]): KategoriLaporan => ({
        kategori,
        penjualan: k.penjualan,
        laba: k.dengan === 0 ? null : k.laba,
        margin: k.dengan === 0 || k.modalRevenue === 0 ? null : Math.round((k.laba / k.modalRevenue) * 1000) / 10,
        barisDenganModal: k.dengan,
        barisTotal: k.total,
      }))
      .sort((a, b) => b.penjualan - a.penjualan),
    terlaris: [...terlaris.values()].sort((a, b) => b.penjualan - a.penjualan).slice(0, TOP_TERLARIS),
    perHari: [...perHari.entries()].map(([hari, p]) => ({ hari, penjualan: p })),
  }
}

/**
 * itemId -> kategori name. A ukuran's kategori is owned by its barang; a
 * legacy item with no barang (or whose barang row has not reached this device)
 * falls back to its own kategori text. Undefined when there is none.
 */
export function kategoriNamaPerItem(items: Item[], barang: Barang[], entries: KategoriEntry[]): (itemId: string) => string | undefined {
  const barangById = new Map(barang.map(b => [b.id, b]))
  const entryById = new Map(entries.map(e => [e.id, e]))
  const namaByItem = new Map<string, string | undefined>()
  for (const item of items) {
    const owner = item.barangId === undefined ? undefined : barangById.get(item.barangId)
    namaByItem.set(item.id, resolveKategori(owner ?? item, entryById).nama)
  }
  return itemId => namaByItem.get(itemId)
}
