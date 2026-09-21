import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { fromBase, qty } from '../../domain/quantity'

/**
 * itemsProj joined with stokProj, in memory: itemsProj carries kategori and
 * stokMinimum, stokProj carries the running quantity, and IndexedDB has no
 * join. Toko scale (hundreds to low thousands of SKUs) keeps this
 * comfortably inside budget. See the plan's Decision on stokProj's
 * itemId-only primary key for the reasoning.
 */
export type StokStatus = 'habis' | 'menipis' | 'aman'

export type StokRow = {
  itemId: string
  nama: string
  baseUnit: string
  kategori?: string
  barcode?: string
  hargaEceran: number
  stokMinimum: number
  /** Whole units of baseUnit (already converted from stokProj's milli-units). */
  quantity: number
  status: StokStatus
}

/**
 * Status thresholds compare whole-unit quantity against stokMinimum, which is
 * itself stored in whole units (see ItemForm/recordItem: stokMinimum is typed
 * and stored as-is, never passed through toBase). Comparing stokProj's raw
 * milli-units against a whole-unit stokMinimum would be off by a factor of
 * 1000, so the same fromBase conversion used for display also feeds status.
 */
export function computeStokStatus(quantity: number, stokMinimum: number): StokStatus {
  if (quantity <= 0) return 'habis'
  if (quantity < stokMinimum) return 'menipis'
  return 'aman'
}

/**
 * Live-joined stok rows, or undefined while the first query has not resolved
 * yet (useLiveQuery's own convention for "loading").
 */
export function useStokList(): StokRow[] | undefined {
  return useLiveQuery(async () => {
    const [items, levels] = await Promise.all([db.itemsProj.toArray(), db.stokProj.toArray()])
    const levelByItemId = new Map(levels.map(level => [level.itemId, level]))

    return items.map((item): StokRow => {
      // An item that never had a StockAdjusted event (no "Stok awal" at
      // creation) has no stokProj row at all: treated as quantity 0.
      const milliQuantity = levelByItemId.get(item.id)?.quantity ?? 0
      const quantity = fromBase(qty(milliQuantity), { unit: item.baseUnit, factor: 1 })

      return {
        itemId: item.id,
        nama: item.nama,
        baseUnit: item.baseUnit,
        kategori: item.kategori,
        barcode: item.barcode,
        hargaEceran: item.hargaEceran,
        stokMinimum: item.stokMinimum,
        quantity,
        status: computeStokStatus(quantity, item.stokMinimum),
      }
    })
  }, [])
}

export type StokStatusFilter = 'semua' | 'habis' | 'menipis'

export type StokFilterState = {
  search: string
  status: StokStatusFilter
  /** null means "semua kategori". */
  kategori: string | null
}

export const EMPTY_STOK_FILTERS: StokFilterState = { search: '', status: 'semua', kategori: null }

/**
 * Plain synchronous filtering over the already-joined rows. Kept as a pure
 * function (not folded into the hook) so ItemList and its tests can exercise
 * it without a live Dexie instance.
 */
export function filterStokRows(rows: StokRow[], filters: StokFilterState): StokRow[] {
  const search = filters.search.trim().toLowerCase()

  return rows.filter(row => {
    if (search) {
      const matchesNama = row.nama.toLowerCase().includes(search)
      const matchesBarcode = row.barcode?.toLowerCase().includes(search) ?? false
      if (!matchesNama && !matchesBarcode) return false
    }
    if (filters.status !== 'semua' && row.status !== filters.status) return false
    if (filters.kategori !== null && row.kategori !== filters.kategori) return false
    return true
  })
}
