import type { BarangRow } from '../shared/useKatalog'

/**
 * The barang the Kasir grid can actually sell from: not archived, with at
 * least one non-archived ukuran. A barang with zero purchasable ukuran has
 * nothing to add to a cart - a card with a header and no rows makes no sense
 * in a POS grid, unlike Kamus's own list, which deliberately still shows it
 * (for editing, not selling). Shared by ProductGrid (what it renders) and
 * Kasir (whether a typed search found anything at all, i.e. whether to offer
 * "Tambah barang baru"), so the two can never disagree: a barang the grid
 * cannot show must never count as a search match.
 */
export function purchasableBarangRows(rows: BarangRow[]): BarangRow[] {
  return rows.filter(r => !r.diarsipkan && r.ukuran.some(u => !u.diarsipkan))
}

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
