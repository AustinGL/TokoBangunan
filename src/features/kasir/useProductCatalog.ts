import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { fromBase, qty } from '../../domain/quantity'
import { computeStokStatus, type StokStatus } from '../../domain/stokStatus'

/**
 * itemsProj joined with stokProj, in memory, same pattern as
 * features/stok/useStokList.ts. Kept in its own file (not ProductGrid.tsx)
 * for the same reason useStokList.ts is split out from ItemList.tsx:
 * react-refresh/only-export-components forbids a component file from also
 * exporting plain functions/types.
 *
 * ProductStatus/computeProductStatus used to duplicate
 * features/stok/useStokList.ts's own copy byte-for-byte (each with a doc
 * comment flagging it as a judgment call to revisit); both now delegate to
 * the shared domain/stokStatus.ts, re-exported under this file's existing
 * names so call sites keep working unchanged.
 */

export type ProductStatus = StokStatus
export const computeProductStatus = computeStokStatus

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
