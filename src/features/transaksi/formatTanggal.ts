/**
 * MASTER.md section 10's date rule ("18 Sep 2026"). Its own small file, not
 * exported alongside a component, so SaleList.tsx and SaleDetail.tsx (which
 * both need it) stay Fast-Refresh-clean: a file react-refresh's
 * only-export-components rule allows must export components only.
 */
export function formatTanggal(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}
