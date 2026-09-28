import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { buildRiwayatRows, type RiwayatRow, type BatchWithMeta, type LegacyInput } from './riwayatStok'

/**
 * Riwayat stok for one or more ukuran (itemId) of the same barang - one
 * item when a card is selected, every surviving ukuran when "Semua ukuran"
 * is active (BarangDetail.tsx decides which). Joins batchesProj,
 * suppliersProj, salesProj and stokProj in memory, the same toko-scale
 * in-memory-join budget useKatalog.ts's own doc comment already
 * establishes for this codebase.
 */
export function useRiwayatStok(items: Array<{ id: string; baseUnit: string }>): RiwayatRow[] | undefined {
  const itemIds = items.map(i => i.id)
  // useLiveQuery re-runs whenever a dependency changes by reference; items
  // is rebuilt fresh on every caller render, so a stable primitive key (the
  // joined ids) is passed as the actual dependency instead, avoiding an
  // infinite re-query loop.
  const key = itemIds.join(',')

  return useLiveQuery(async () => {
    if (itemIds.length === 0) return []

    const [batches, suppliers, sales, levels] = await Promise.all([
      db.batchesProj.where('itemId').anyOf(itemIds).toArray(),
      db.suppliersProj.toArray(),
      // .distinct(): itemIds is a multi-entry index, and Dexie's anyOf over
      // one can return the same sale more than once when it matches several
      // of the queried ids - without this, a sale spanning two of the
      // requested items would be double-counted below.
      db.salesProj.where('itemIds').anyOf(itemIds).distinct().toArray(),
      db.stokProj.bulkGet(itemIds),
    ])

    const supplierNamaById = new Map(suppliers.map(s => [s.id, s.nama]))
    const baseUnitByItemId = new Map(items.map(i => [i.id, i.baseUnit]))

    const transaksiCountByBatchId = new Map<string, number>()
    const legacyTransaksiCountByItemId = new Map<string, number>()

    for (const sale of sales) {
      if (sale.status === 'batal') continue
      const batchIdsInThisSale = new Set<string>()
      const legacyItemIdsInThisSale = new Set<string>()
      for (const line of sale.lines) {
        if (!itemIds.includes(line.itemId)) continue
        if (line.batchId) batchIdsInThisSale.add(line.batchId)
        else legacyItemIdsInThisSale.add(line.itemId)
      }
      for (const batchId of batchIdsInThisSale) {
        transaksiCountByBatchId.set(batchId, (transaksiCountByBatchId.get(batchId) ?? 0) + 1)
      }
      for (const itemId of legacyItemIdsInThisSale) {
        legacyTransaksiCountByItemId.set(itemId, (legacyTransaksiCountByItemId.get(itemId) ?? 0) + 1)
      }
    }

    const batchesWithMeta: BatchWithMeta[] = batches.map(batch => ({
      batch,
      supplierNama: batch.supplierId ? supplierNamaById.get(batch.supplierId) : undefined,
      transaksiCount: transaksiCountByBatchId.get(batch.batchId) ?? 0,
      ukuran: baseUnitByItemId.get(batch.itemId) ?? '',
    }))

    const batchSisaMilliByItemId = new Map<string, number>()
    for (const batch of batches) {
      batchSisaMilliByItemId.set(batch.itemId, (batchSisaMilliByItemId.get(batch.itemId) ?? 0) + batch.sisa)
    }

    const legacies: LegacyInput[] = items.map((item, i) => ({
      itemId: item.id,
      ukuran: item.baseUnit,
      sisaMilli: (levels[i]?.quantity ?? 0) - (batchSisaMilliByItemId.get(item.id) ?? 0),
      transaksiCount: legacyTransaksiCountByItemId.get(item.id) ?? 0,
    }))

    return buildRiwayatRows(batchesWithMeta, legacies)
  }, [key])
}
