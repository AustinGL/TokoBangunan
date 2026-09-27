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

/**
 * batchId undefined with no shortfall: the legacy pool ("Stok lama") covers
 * qty in full. batchId set with shortfall undefined: that batch alone
 * covers qty in full. batchId set with shortfall set (milli-units, the
 * amount qty exceeds what that batch has left): over-selling, which never
 * blocks (flow spec D7) - the caller formats its own message from this
 * number plus the batch's own tanggalBeli, since domain/ has no date
 * formatting or copy of its own.
 */
export type BatchPick = { batchId?: string; shortfall?: number }

/**
 * Walks: the legacy remainder first (no batch, "Stok lama"), then the
 * oldest batch (by tanggalBeli) with enough availability, then the newest
 * batch anyway with a shortfall, then no batch when there is nothing at all
 * to sell from. legacyAvailable is the raw legacyRemainder(...) value (not
 * yet reduced by other cart lines) - this function itself subtracts
 * whatever other lines on this item already draw from the legacy pool
 * (lines with no batchId), the same way availableForLine subtracts other
 * lines' claims on a specific batch.
 */
export function pickDefaultBatch(
  itemId: string,
  qty: number,
  legacyAvailable: number,
  batches: BatchLike[],
  otherLines: CartLineLike[],
): BatchPick {
  const legacyClaimed = otherLines
    .filter(l => l.itemId === itemId && l.batchId === undefined)
    .reduce((sum, l) => sum + l.qty, 0)
  if (legacyAvailable - legacyClaimed >= qty) return {}

  const itemBatches = batches.filter(b => b.itemId === itemId).sort((a, b) => (a.tanggalBeli < b.tanggalBeli ? -1 : 1))
  const withEnough = itemBatches.find(b => availableForLine(b, otherLines) >= qty)
  if (withEnough) return { batchId: withEnough.batchId }

  const newest = itemBatches[itemBatches.length - 1]
  if (newest) return { batchId: newest.batchId, shortfall: qty - availableForLine(newest, otherLines) }

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
