import type { BarangRow } from '../shared/useKatalog'

/**
 * Matches a barang into the grid: its own nama, OR any of its non-archived
 * ukuran's own ukuran text or barcode. kategori narrows on the barang's own
 * kategori, same as Stok's own category pills. Kept in its own file, not
 * ProductGrid.tsx: react-refresh/only-export-components forbids a
 * component file from also exporting a plain function (the same reason
 * useProductCatalog.ts was originally split from ProductGrid.tsx).
 */
export function filterBarangRows(rows: BarangRow[], searchQuery: string, kategori: string | null): BarangRow[] {
  const search = searchQuery.trim().toLowerCase()

  return rows.filter(row => {
    if (kategori !== null && row.kategori !== kategori) return false
    if (!search) return true
    const matchesNama = row.nama.toLowerCase().includes(search)
    const matchesUkuran = row.ukuran.some(u =>
      !u.diarsipkan && (u.ukuran.toLowerCase().includes(search) || (u.barcode?.toLowerCase().includes(search) ?? false)),
    )
    return matchesNama || matchesUkuran
  })
}
