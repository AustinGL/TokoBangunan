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
