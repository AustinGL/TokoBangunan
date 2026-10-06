import { localDayKey } from './dashboard'
import { dateAtLocalNoon } from './tanggal'
import type { Customer } from './projections/customers'
import type { Payment } from './projections/payments'
import type { Sale } from './projections/sales'

/**
 * Receivables, derived. Nothing here is stored: the balance of every nota is
 * the sale's total minus its down payment minus its PaymentReceived events, so
 * a correction is only ever a new event. "Today" is passed in (a yyyy-mm-dd
 * local day key); this module never reads the wall clock.
 */

export type PiutangStatus = 'lewat' | 'segera' | 'berjalan'

/** A due date this many days away (today included) or fewer is "segera". */
export const HARI_SEGERA = 3

export const PELANGGAN_TIDAK_DIKENAL = 'Pelanggan tidak dikenal'

export type NotaBelumLunas = { saleId: string; jatuhTempo: string; occurredAt: string; sisa: number }

export type NotaPiutang = NotaBelumLunas & {
  customerId: string
  total: number
  /** Down payment plus every payment so far. */
  dibayar: number
  status: PiutangStatus
  /** Days past due; 0 unless status is 'lewat'. */
  hariLewat: number
  /** Days until due; 0 when due today or past due. */
  hariLagi: number
}

export type PembayaranRiwayat = { id: string; saleId: string; jumlah: number; catatan?: string; occurredAt: string }

export type PelangganPiutang = {
  customerId: string
  nama: string
  telepon?: string
  totalSisa: number
  jumlahNota: number
  /** The status of the customer's most overdue nota. */
  status: PiutangStatus
  hariLewat: number
  hariLagi: number
  jatuhTempoTerdekat: string
  /**
   * How much of totalSisa is actually past due, and how much falls due within
   * HARI_SEGERA days. A customer's status comes from the nota due first, but
   * their balance may be mostly notas that are not due yet: anything said to
   * the customer or the owner about "overdue" must use these, not totalSisa.
   */
  sisaLewat: number
  sisaSegera: number
  /** Unpaid notas, oldest due first. */
  nota: NotaPiutang[]
  /** Every payment on any of the customer's Bon sales, newest first. */
  pembayaran: PembayaranRiwayat[]
}

export type RingkasanPiutang = {
  totalSisa: number
  jumlahPelanggan: number
  jumlahLewatTempo: number
  pelanggan: PelangganPiutang[]
}

/**
 * What is still owed on a nota. Clamped at zero: two devices can record a
 * payment against the same nota before they sync, and the sum may then
 * exceed the total. That nota is shown as lunas rather than as a negative.
 */
export function sisaNota(sale: Pick<Sale, 'total' | 'dibayarAwal'>, payments: Array<{ jumlah: number }>): number {
  const dibayar = (sale.dibayarAwal ?? 0) + payments.reduce((sum, p) => sum + p.jumlah, 0)
  return Math.max(0, sale.total - dibayar)
}

const isBonAktif = (s: Sale): boolean =>
  s.metodeBayar === 'bon' && s.status === 'aktif' && s.customerId !== undefined && s.jatuhTempo !== undefined

const groupBySale = (payments: Payment[]): Map<string, Payment[]> => {
  const map = new Map<string, Payment[]>()
  for (const p of payments) map.set(p.saleId, [...(map.get(p.saleId) ?? []), p])
  return map
}

/** Whole local days from one day key to another (positive when `ke` is later). */
const selisihHari = (dari: string, ke: string): number =>
  Math.round((dateAtLocalNoon(ke).getTime() - dateAtLocalNoon(dari).getTime()) / 86_400_000)

const urutanNota = (a: { jatuhTempo: string; occurredAt: string }, b: { jatuhTempo: string; occurredAt: string }): number =>
  a.jatuhTempo.localeCompare(b.jatuhTempo) || a.occurredAt.localeCompare(b.occurredAt)

const RANK: Record<PiutangStatus, number> = { lewat: 0, segera: 1, berjalan: 2 }

export function hitungPiutang(sales: Sale[], payments: Payment[], customers: Customer[], hariIni: string): RingkasanPiutang {
  const customerById = new Map(customers.map(c => [c.id, c]))
  const bayarPerSale = groupBySale(payments)
  const notaPerPelanggan = new Map<string, NotaPiutang[]>()
  const saleIdsPerPelanggan = new Map<string, Set<string>>()

  for (const sale of sales.filter(isBonAktif)) {
    const customerId = sale.customerId as string
    saleIdsPerPelanggan.set(customerId, (saleIdsPerPelanggan.get(customerId) ?? new Set<string>()).add(sale.id))

    const sisa = sisaNota(sale, bayarPerSale.get(sale.id) ?? [])
    if (sisa === 0) continue

    const jatuhTempo = sale.jatuhTempo as string
    const selisih = selisihHari(hariIni, jatuhTempo)
    const status: PiutangStatus = selisih < 0 ? 'lewat' : selisih <= HARI_SEGERA ? 'segera' : 'berjalan'
    const nota: NotaPiutang = {
      saleId: sale.id, customerId, occurredAt: sale.occurredAt, jatuhTempo, total: sale.total,
      dibayar: sale.total - sisa, sisa, status,
      hariLewat: selisih < 0 ? -selisih : 0,
      hariLagi: selisih > 0 ? selisih : 0,
    }
    notaPerPelanggan.set(customerId, [...(notaPerPelanggan.get(customerId) ?? []), nota])
  }

  const pelanggan: PelangganPiutang[] = []
  for (const [customerId, notaList] of notaPerPelanggan) {
    notaList.sort(urutanNota)
    const terdekat = notaList[0]
    const saleIds = saleIdsPerPelanggan.get(customerId) ?? new Set<string>()
    const customer = customerById.get(customerId)
    pelanggan.push({
      customerId,
      nama: customer?.nama ?? PELANGGAN_TIDAK_DIKENAL,
      telepon: customer?.telepon,
      totalSisa: notaList.reduce((sum, n) => sum + n.sisa, 0),
      jumlahNota: notaList.length,
      status: terdekat.status,
      hariLewat: terdekat.hariLewat,
      hariLagi: terdekat.hariLagi,
      jatuhTempoTerdekat: terdekat.jatuhTempo,
      sisaLewat: notaList.filter(n => n.status === 'lewat').reduce((sum, n) => sum + n.sisa, 0),
      sisaSegera: notaList.filter(n => n.status === 'segera').reduce((sum, n) => sum + n.sisa, 0),
      nota: notaList,
      pembayaran: payments
        .filter(p => saleIds.has(p.saleId))
        .map(p => ({ id: p.id, saleId: p.saleId, jumlah: p.jumlah, catatan: p.catatan, occurredAt: p.occurredAt }))
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id)),
    })
  }

  pelanggan.sort((a, b) =>
    RANK[a.status] - RANK[b.status]
    || (a.status !== 'berjalan' ? a.jatuhTempoTerdekat.localeCompare(b.jatuhTempoTerdekat) : 0)
    || b.totalSisa - a.totalSisa
    || a.nama.localeCompare(b.nama),
  )

  return {
    totalSisa: pelanggan.reduce((sum, p) => sum + p.totalSisa, 0),
    jumlahPelanggan: pelanggan.length,
    jumlahLewatTempo: pelanggan.filter(p => p.status === 'lewat').length,
    pelanggan,
  }
}

/**
 * The earliest day a payment on these notas can be dated: the latest local day
 * among them, since nothing can be paid before it exists. Undefined for none.
 */
export function tanggalBayarTerendah(nota: Array<{ occurredAt: string }>): string | undefined {
  const hari = nota.map(n => localDayKey(new Date(n.occurredAt))).sort()
  return hari[hari.length - 1]
}

/** One customer's unpaid, active Bon notas, oldest due first. */
export function notaBelumLunas(sales: Sale[], payments: Payment[], customerId: string): NotaBelumLunas[] {
  const bayarPerSale = groupBySale(payments)
  return sales
    .filter(s => isBonAktif(s) && s.customerId === customerId)
    .map(s => ({
      saleId: s.id,
      jatuhTempo: s.jatuhTempo as string,
      occurredAt: s.occurredAt,
      sisa: sisaNota(s, bayarPerSale.get(s.id) ?? []),
    }))
    .filter(n => n.sisa > 0)
    .sort(urutanNota)
}

/**
 * Splits `jumlah` over notas, oldest due first (ties: oldest occurredAt),
 * never giving a nota more than its sisa. Sorts its own copy: the caller's
 * order is not trusted. Throws before allocating anything when the amount is
 * not a positive whole number or exceeds what is owed in total.
 */
export function alokasiTerlama(nota: NotaBelumLunas[], jumlah: number): Array<{ saleId: string; jumlah: number }> {
  if (!Number.isInteger(jumlah) || jumlah <= 0) throw new Error('Jumlah harus lebih dari 0.')
  if (jumlah > nota.reduce((sum, n) => sum + n.sisa, 0)) throw new Error('Jumlah melebihi total piutang.')

  const alokasi: Array<{ saleId: string; jumlah: number }> = []
  let sisaBayar = jumlah
  for (const n of [...nota].sort(urutanNota)) {
    if (sisaBayar === 0) break
    const bagian = Math.min(n.sisa, sisaBayar)
    alokasi.push({ saleId: n.saleId, jumlah: bagian })
    sisaBayar -= bagian
  }
  return alokasi
}
