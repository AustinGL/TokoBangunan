import { sisaNota, type PelangganPiutang, type PembayaranRiwayat, type PiutangStatus, type RingkasanPiutang } from './piutang'
import type { Customer } from './projections/customers'
import type { Payment } from './projections/payments'
import type { Sale } from './projections/sales'

/**
 * The Pelanggan master list and one customer's full Bon history. Pure: both
 * are derived from the same projections as Piutang, nothing is stored.
 */

export type BarisPelanggan = {
  id: string
  nama: string
  telepon?: string
  alamat?: string
  /** 0 for a customer who owes nothing (never took Bon, or paid it all). */
  totalSisa: number
  jumlahNota: number
  /** Only for a customer who owes something. */
  status?: PiutangStatus
  /** Paid beyond what was owed (see kelebihanBayar); 0 when nothing is overpaid. */
  kelebihan: number
}

/** Every customer, by name, with what they still owe taken from the Piutang summary. */
export function daftarPelanggan(
  customers: Customer[], ringkasan: RingkasanPiutang, kelebihan: Record<string, number> = {},
): BarisPelanggan[] {
  const berutang = new Map<string, PelangganPiutang>(ringkasan.pelanggan.map(p => [p.customerId, p]))
  return customers
    .map(c => {
      const p = berutang.get(c.id)
      return {
        id: c.id, nama: c.nama, telepon: c.telepon, alamat: c.alamat,
        totalSisa: p?.totalSisa ?? 0, jumlahNota: p?.jumlahNota ?? 0, status: p?.status, kelebihan: kelebihan[c.id] ?? 0,
      }
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' }))
}

const isBonAktif = (s: Sale): boolean =>
  s.metodeBayar === 'bon' && s.status === 'aktif' && s.customerId !== undefined && s.jatuhTempo !== undefined

/** What was paid on a nota, down payment included, before the balance is clamped at zero. */
const terbayar = (sale: Sale, payments: Payment[]): number =>
  (sale.dibayarAwal ?? 0) + payments.filter(p => p.saleId === sale.id).reduce((sum, p) => sum + p.jumlah, 0)

/**
 * Per customer, how much was paid beyond what their active Bon notas came to.
 * Two devices can record the same payment before they sync; a nota's balance
 * is then clamped at zero (it shows as lunas) and this is what makes the
 * extra money visible instead of silently absorbed. Customers with none are left out.
 */
export function kelebihanBayar(sales: Sale[], payments: Payment[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const sale of sales.filter(isBonAktif)) {
    const lebih = terbayar(sale, payments) - sale.total
    if (lebih > 0) out[sale.customerId as string] = (out[sale.customerId as string] ?? 0) + lebih
  }
  return out
}

const digitsOf = (s: string): string => s.replace(/\D/g, '')

/** Name part, or phone digits in any format. A query without digits never matches by phone. */
export function cariPelanggan(rows: BarisPelanggan[], query: string): BarisPelanggan[] {
  const q = query.trim().toLowerCase()
  if (q === '') return rows
  const qDigits = digitsOf(q)
  return rows.filter(r =>
    r.nama.toLowerCase().includes(q)
    || (qDigits !== '' && r.telepon !== undefined && digitsOf(r.telepon).includes(qDigits)),
  )
}

export type NotaRiwayat = {
  saleId: string
  occurredAt: string
  jatuhTempo: string
  total: number
  /** Down payment plus every payment so far, never more than the total. */
  dibayar: number
  sisa: number
  /** Paid beyond the total (a payment recorded twice on two devices); 0 normally. */
  lebih: number
}

/** All of one customer's active Bon notas (paid off ones too) and payments, newest first. */
export function riwayatBon(
  sales: Sale[], payments: Payment[], customerId: string,
): { nota: NotaRiwayat[]; pembayaran: PembayaranRiwayat[] } {
  const miliknya = sales.filter(s =>
    s.metodeBayar === 'bon' && s.status === 'aktif' && s.customerId === customerId && s.jatuhTempo !== undefined)
  const ids = new Set(miliknya.map(s => s.id))
  const bayarPerSale = (id: string) => payments.filter(p => p.saleId === id)

  return {
    nota: miliknya
      .map(s => {
        const sisa = sisaNota(s, bayarPerSale(s.id))
        return {
          saleId: s.id, occurredAt: s.occurredAt, jatuhTempo: s.jatuhTempo as string,
          total: s.total, dibayar: s.total - sisa, sisa, lebih: Math.max(0, terbayar(s, payments) - s.total),
        }
      })
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.saleId.localeCompare(a.saleId)),
    pembayaran: payments
      .filter(p => ids.has(p.saleId))
      .map(p => ({ id: p.id, saleId: p.saleId, jumlah: p.jumlah, catatan: p.catatan, occurredAt: p.occurredAt }))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id)),
  }
}
