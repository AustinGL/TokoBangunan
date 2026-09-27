export type CartLineLike = { itemId: string; batchId?: string; qty: number }
export type BatchLike = { batchId: string; itemId: string; sisa: number; tanggalBeli: string }

/** Stock not tracked in any batch: the item's aggregate stokProj total minus the sum of that item's own batches' sisa. */
export function legacyRemainder(stokQuantity: number, batches: Array<{ itemId: string; sisa: number }>, itemId: string): number {
  const batchTotal = batches.filter(b => b.itemId === itemId).reduce((sum, b) => sum + b.sisa, 0)
  return stokQuantity - batchTotal
}

/** A batch's sisa minus whatever the OTHER lines already in this cart claim from it. */
export function availableForLine(b: { batchId: string; sisa: number }, otherLines: CartLineLike[]): number {
  const claimed = otherLines.filter(l => l.batchId === b.batchId).reduce((sum, l) => sum + l.qty, 0)
  return b.sisa - claimed
}

export type BatchPick = { batchId?: string; warning?: string }

/**
 * Walks: the legacy remainder first (no batch, "Stok lama"), then the
 * oldest batch (by tanggalBeli) with enough availability, then the newest
 * batch anyway with a warning (over-selling never blocks - flow spec D7),
 * then no batch when there is nothing at all to sell from.
 */
export function pickDefaultBatch(
  itemId: string,
  qty: number,
  legacyAvailable: number,
  batches: BatchLike[],
  otherLines: CartLineLike[],
): BatchPick {
  if (legacyAvailable >= qty) return {}

  const itemBatches = batches.filter(b => b.itemId === itemId).sort((a, b) => (a.tanggalBeli < b.tanggalBeli ? -1 : 1))
  const withEnough = itemBatches.find(b => availableForLine(b, otherLines) >= qty)
  if (withEnough) return { batchId: withEnough.batchId }

  const newest = itemBatches[itemBatches.length - 1]
  if (newest) return { batchId: newest.batchId, warning: `Ambil ${qty} dari batch ${newest.tanggalBeli}` }

  return {}
}

export type SplitPlan = Array<{ batchId: string; qty: number }>

/** The one-tap split: fills from the oldest batch with any availability, then the next, until qty is covered or batches run out. */
export function planSplit(
  itemId: string,
  qty: number,
  batches: BatchLike[],
  otherLines: CartLineLike[],
): SplitPlan {
  const itemBatches = batches.filter(b => b.itemId === itemId).sort((a, b) => (a.tanggalBeli < b.tanggalBeli ? -1 : 1))
  const plan: SplitPlan = []
  let remaining = qty

  for (const b of itemBatches) {
    if (remaining <= 0) break
    const available = availableForLine(b, otherLines)
    if (available <= 0) continue
    const take = Math.min(available, remaining)
    plan.push({ batchId: b.batchId, qty: take })
    remaining -= take
  }

  return plan
}
