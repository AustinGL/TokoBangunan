import { useMemo, useState } from 'react'
import { CategoryPills } from '../../ui/CategoryPills'
import { ProductCard } from './ProductCard'
import { useKatalog, type UkuranRow } from '../shared/useKatalog'
import { filterBarangRows, purchasableBarangRows } from './filterBarangRows'

type Props = {
  /** Filters the grid against barang nama and each ukuran's own ukuran text/barcode. */
  searchQuery: string
  /** Called with the tapped ukuran row and its barang's nama. Cart state stays owned by the caller. */
  onAdd: (ukuran: UkuranRow, barangNama: string) => void
}

export function ProductGrid({ searchQuery, onAdd }: Props) {
  const rows = useKatalog()
  const [kategori, setKategori] = useState<string | null>(null)

  // Same sellable-row set Kasir's own "no match" check uses (see
  // purchasableBarangRows' doc comment).
  const purchasable = useMemo(() => purchasableBarangRows(rows ?? []), [rows])

  const categories = useMemo(() => {
    const distinct = new Set(purchasable.map(r => r.kategori).filter((k): k is string => Boolean(k)))
    return Array.from(distinct).sort()
  }, [purchasable])

  const categoryOptions = useMemo(
    () => [{ value: 'semua', label: 'Semua' }, ...categories.map(k => ({ value: k, label: k }))],
    [categories],
  )

  const visibleRows = useMemo(
    () => filterBarangRows(purchasable, searchQuery, kategori),
    [purchasable, searchQuery, kategori],
  )

  return (
    <div className="flex flex-col gap-4">
      {categories.length > 0 && (
        <CategoryPills
          name="kasir-kategori"
          aria-label="Filter kategori"
          options={categoryOptions}
          value={kategori ?? 'semua'}
          onChange={value => setKategori(value === 'semua' ? null : value)}
        />
      )}

      {rows === undefined ? (
        <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6">
          <span className="sr-only">Memuat katalog barang...</span>
        </div>
      ) : purchasable.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Belum ada barang.
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Tidak ada barang yang cocok dengan pencarian.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleRows.map(row => (
            <ProductCard key={row.barangId} barang={row} onAdd={ukuran => onAdd(ukuran, row.nama)} />
          ))}
        </div>
      )}
    </div>
  )
}
