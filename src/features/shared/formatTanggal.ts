import { dateAtLocalNoon } from '../../domain/tanggal'

/**
 * MASTER.md section 10's date rule ("18 Sep 2026"). Its own small file, not
 * exported alongside a component, so SaleList.tsx/SaleDetail.tsx (Transaksi)
 * and SupplierSheet.tsx (Supplier) - which all need it - stay Fast-Refresh-
 * clean: a file react-refresh's only-export-components rule allows must
 * export components only. Moved here (from features/transaksi/) once a
 * second feature needed it - see this file's own plan task for why.
 */
export function formatTanggal(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

/** "14.05": the wall-clock time a sale was made, for telling same-day sales apart. */
export function formatJam(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/** "18 Sep 2026" for a yyyy-mm-dd day key. Built from local noon, so no timezone can shift the day. */
export function formatTanggalKey(dayKey: string): string {
  return formatTanggal(dateAtLocalNoon(dayKey).toISOString())
}
