import { localDayKey } from './dashboard'
import { dateAtLocalNoon } from './tanggal'

/**
 * Pure calendar arithmetic for the date pickers. Every date is a local-day key
 * (yyyy-mm-dd) built at local noon, so no timezone or DST shift can move a day.
 * Weeks start on Monday, as is usual in Indonesia.
 */

export type Bulan = { tahun: number; bulan: number } // bulan: 0-11

export const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] as const

const namaBulanFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const namaLengkapFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
const ringkasFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const pad = (n: number): string => String(n).padStart(2, '0')
const noon = (y: number, m: number, d: number): Date => new Date(y, m, d, 12, 0, 0, 0)

/** True only for a real yyyy-mm-dd day (not 2026-02-30, not "NaN-NaN-NaN"). */
export function adalahKey(key: string | null | undefined): key is string {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const [y, m, d] = key.split('-').map(Number)
  const t = noon(y, m - 1, d)
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d
}

export function bulanDari(key: string): Bulan {
  const [tahun, bulan] = key.split('-').map(Number)
  return { tahun, bulan: bulan - 1 }
}

export const awalBulan = (b: Bulan): string => `${b.tahun}-${pad(b.bulan + 1)}-01`

/** "Oktober 2026" */
export const namaBulan = (b: Bulan): string => namaBulanFmt.format(noon(b.tahun, b.bulan, 1))

/** "4 Oktober 2026": the accessible name of a day. */
export const namaLengkap = (key: string): string => namaLengkapFmt.format(dateAtLocalNoon(key))

/** "4 Okt 2026": what a field shows. */
export const ringkas = (key: string): string => ringkasFmt.format(dateAtLocalNoon(key))

export function geserBulan(b: Bulan, n: number): Bulan {
  const d = noon(b.tahun, b.bulan + n, 1)
  return { tahun: d.getFullYear(), bulan: d.getMonth() }
}

export function geserHari(key: string, n: number): string {
  const d = dateAtLocalNoon(key)
  d.setDate(d.getDate() + n)
  return localDayKey(d)
}

/** The same day of the month n months away, clamped (31 January + 1 month = 28 or 29 February). */
export function geserBulanKey(key: string, n: number): string {
  const d = dateAtLocalNoon(key)
  const target = geserBulan({ tahun: d.getFullYear(), bulan: d.getMonth() }, n)
  const panjang = noon(target.tahun, target.bulan + 1, 0).getDate()
  return localDayKey(noon(target.tahun, target.bulan, Math.min(d.getDate(), panjang)))
}

/** Monday = 0 ... Sunday = 6 */
const hariKe = (key: string): number => (dateAtLocalNoon(key).getDay() + 6) % 7

export const awalPekan = (key: string): string => geserHari(key, -hariKe(key))
export const akhirPekan = (key: string): string => geserHari(key, 6 - hariKe(key))

export const batasi = (key: string, min?: string, max?: string): string =>
  min !== undefined && key < min ? min : max !== undefined && key > max ? max : key

export type SelHari = { key: string; dalamBulan: boolean }

/** Six weeks of seven days, Monday first, so a month never changes height. */
export function kisiBulan(b: Bulan): SelHari[][] {
  const awal = awalPekan(awalBulan(b))
  const [y, m, d] = awal.split('-').map(Number)
  return Array.from({ length: 6 }, (_, minggu) =>
    Array.from({ length: 7 }, (_, hari) => {
      const tanggal = noon(y, m - 1, d + minggu * 7 + hari)
      return { key: localDayKey(tanggal), dalamBulan: tanggal.getMonth() === b.bulan }
    }),
  )
}
