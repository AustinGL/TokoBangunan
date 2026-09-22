import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { fromBase, qty } from '../../domain/quantity'

/**
 * itemsProj joined with stokProj, in memory, same pattern as
 * features/stok/useStokList.ts. Kept in its own file (not ProductGrid.tsx)
 * for the same reason useStokList.ts is split out from ItemList.tsx:
 * react-refresh/only-export-components forbids a component file from also
 * exporting plain functions/types.
 */

export type ProductStatus = 'habis' | 'menipis' | 'aman'

export type ProductRow = {
  itemId: string
  nama: string
  baseUnit: string
  hargaEceran: number
  barcode?: string
  kategori?: string
  /** Whole units of baseUnit (already converted from stokProj's milli-units). */
  quantity: number
  stokMinimum: number
  status: ProductStatus
}

/**
 * Same habis/menipis/aman thresholds as
 * features/stok/useStokList.ts's computeStokStatus, deliberately
 * duplicated rather than imported: that module is Stok-feature-internal
 * (see data/commands.ts's own doc comment, "no feature imports another
 * feature's internals"), even though the function itself is small, pure
 * and generic enough to share. Keep this in lockstep with
 * useStokList.ts's computeStokStatus if either ever changes. Judgment
 * call, noted in the report.
 */
export function computeProductStatus(quantity: number, stokMinimum: number): ProductStatus {
  if (quantity <= 0) return 'habis'
  if (quantity < stokMinimum) return 'menipis'
  return 'aman'
}

/**
 * Live-joined product rows, or undefined while the first query has not
 * resolved yet (useLiveQuery's own convention for "loading").
 */
export function useProductCatalog(): ProductRow[] | undefined {
  return useLiveQuery(async () => {
    const [items, levels] = await Promise.all([db.itemsProj.toArray(), db.stokProj.toArray()])
    const levelByItemId = new Map(levels.map(level => [level.itemId, level]))

    return items.map((item): ProductRow => {
      const milliQuantity = levelByItemId.get(item.id)?.quantity ?? 0
      const quantity = fromBase(qty(milliQuantity), { unit: item.baseUnit, factor: 1 })

      return {
        itemId: item.id,
        nama: item.nama,
        baseUnit: item.baseUnit,
        hargaEceran: item.hargaEceran,
        barcode: item.barcode,
        kategori: item.kategori,
        quantity,
        stokMinimum: item.stokMinimum,
        status: computeProductStatus(quantity, item.stokMinimum),
      }
    })
  }, [])
}

/**
 * Plain synchronous filtering over the already-joined rows, kept pure so it
 * and its tests do not need a live Dexie instance, mirroring
 * filterStokRows.
 */
export function filterProductRows(rows: ProductRow[], searchQuery: string, kategori: string | null): ProductRow[] {
  const search = searchQuery.trim().toLowerCase()

  return rows.filter(row => {
    if (search) {
      const matchesNama = row.nama.toLowerCase().includes(search)
      const matchesBarcode = row.barcode?.toLowerCase().includes(search) ?? false
      if (!matchesNama && !matchesBarcode) return false
    }
    if (kategori !== null && row.kategori !== kategori) return false
    return true
  })
}
