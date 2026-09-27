import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { groupUkuranByBarang } from '../../domain/katalog'
import { computeStokStatus, type StokStatus } from '../../domain/stokStatus'
import { fromBase, qty } from '../../domain/quantity'

export type UkuranRow = {
  id: string
  ukuran: string
  barcode?: string
  hargaEceran: number
  stokMinimum: number
  diarsipkan: boolean
  /** Whole units of the ukuran's own baseUnit (already converted from stokProj's milli-units). */
  quantity: number
  status: StokStatus
}

export type BarangRow = {
  barangId: string
  nama: string
  kategori?: string
  diarsipkan: boolean
  ukuran: UkuranRow[]
}

/**
 * Joins itemsProj (via groupUkuranByBarang), barangProj and stokProj in
 * memory - the same three-way join useStokList/useProductCatalog already do
 * two-way, at the same toko-scale budget (see useStokList.ts's own doc
 * comment for the reasoning).
 */
export function useKatalog(): BarangRow[] | undefined {
  return useLiveQuery(async () => {
    const [items, barangRows, levels] = await Promise.all([
      db.itemsProj.toArray(), db.barangProj.toArray(), db.stokProj.toArray(),
    ])
    const barangById = Object.fromEntries(barangRows.map(b => [b.id, b]))
    const levelByItemId = new Map(levels.map(l => [l.itemId, l]))

    const groups = groupUkuranByBarang(items, barangById).map((group): BarangRow => ({
      barangId: group.barangId,
      nama: group.nama,
      kategori: group.kategori,
      diarsipkan: group.diarsipkan,
      ukuran: group.ukuran.map((item): UkuranRow => {
        const milli = levelByItemId.get(item.id)?.quantity ?? 0
        const quantity = fromBase(qty(milli), { unit: item.baseUnit, factor: 1 })
        return {
          id: item.id,
          ukuran: item.baseUnit,
          barcode: item.barcode,
          hargaEceran: item.hargaEceran,
          stokMinimum: item.stokMinimum,
          diarsipkan: item.diarsipkan,
          quantity,
          status: computeStokStatus(quantity, item.stokMinimum),
        }
      }),
    }))

    // groupUkuranByBarang only ever produces a row for a barang that has at
    // least one ukuran (item) - a barang just created via BarangSheet, with
    // none yet, would otherwise vanish from the list entirely.
    const groupedIds = new Set(groups.map(g => g.barangId))
    const emptyBarangRows: BarangRow[] = barangRows
      .filter(b => !groupedIds.has(b.id))
      .map((b): BarangRow => ({ barangId: b.id, nama: b.nama, kategori: b.kategori, diarsipkan: b.diarsipkan, ukuran: [] }))

    return [...groups, ...emptyBarangRows]
  }, [])
}
