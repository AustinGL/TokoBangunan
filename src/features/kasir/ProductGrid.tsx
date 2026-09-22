import { useMemo, useState } from 'react'
import { CategoryPills } from '../../ui/CategoryPills'
import { ProductCard } from './ProductCard'
import { useProductCatalog, filterProductRows, type ProductRow } from './useProductCatalog'

/**
 * Component breakdown table groups "category pills, product grid" together
 * under Kasir's scope, so CategoryPills is mounted here rather than one
 * level up in a Task 6b screen shell -- a judgment call (the brief allows
 * either), chosen so ProductGrid stays a self-contained, testable unit on
 * its own, the same way this file's live-query/filter split (in
 * useProductCatalog.ts) mirrors useStokList.ts's.
 */

type Props = {
  /** Filters the grid against nama and barcode, matching Stok's own search behavior. */
  searchQuery: string
  /** Called with the clicked ProductCard's item. Cart state stays owned by the parent. */
  onAdd: (item: ProductRow) => void
}

export function ProductGrid({ searchQuery, onAdd }: Props) {
  const rows = useProductCatalog()
  const [kategori, setKategori] = useState<string | null>(null)

  const categories = useMemo(() => {
    if (!rows) return []
    const distinct = new Set(rows.map(row => row.kategori).filter((k): k is string => Boolean(k)))
    return Array.from(distinct).sort()
  }, [rows])

  const categoryOptions = useMemo(
    () => [{ value: 'semua', label: 'Semua' }, ...categories.map(k => ({ value: k, label: k }))],
    [categories],
  )

  const visibleRows = useMemo(
    () => (rows ? filterProductRows(rows, searchQuery, kategori) : []),
    [rows, searchQuery, kategori],
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
      ) : rows.length === 0 ? (
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
            <ProductCard key={row.itemId} item={row} onAdd={onAdd} />
          ))}
        </div>
      )}
    </div>
  )
}
