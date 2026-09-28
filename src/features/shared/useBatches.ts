import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Batch } from '../../domain/projections/batches'

/**
 * Live batches for one ukuran, oldest tanggalBeli first - the same FIFO
 * order src/domain/batchPick.ts's pickDefaultBatch/planSplit walk, so a
 * caller that renders these rows directly (the batch-chip's change-batch
 * list) shows them in the same order the auto-pick logic reasons about.
 */
export function useBatches(itemId: string): Batch[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.batchesProj.where('itemId').equals(itemId).toArray()
    return rows.sort((a, b) => (a.tanggalBeli < b.tanggalBeli ? -1 : a.tanggalBeli > b.tanggalBeli ? 1 : 0))
  }, [itemId])
}
