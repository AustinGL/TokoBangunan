import type { EventEnvelope } from '../events'

export type StockLevel = {
  itemId: string
  quantity: number            // running total, milli-units of baseUnit
  lastMovementAt: string
  lastMovementEventId: string
}
export type StockState = Record<string, StockLevel>

/**
 * Additive accumulator, unlike reduceItems's last-write-wins overwrite.
 * Addition is commutative, so folding +10, -3, -3 in any order always
 * yields the same running total: the total needs no fold-order guard.
 *
 * The (recordedAt, id) tie-break here only protects lastMovementAt and
 * lastMovementEventId (audit display, "terakhir disesuaikan pada..."),
 * which can genuinely regress if folded out of order. It never discards a
 * quantity contribution the way reduceItems discards a losing write.
 *
 * Negative totals are legal: a habis/negative stock warns in the UI later,
 * never blocks at the domain layer.
 */
export function reduceStock(state: StockState, event: EventEnvelope): StockState {
  if (event.type !== 'StockAdjusted') return state
  const payload = event.payload as { itemId: string; quantity: number }
  const existing = state[payload.itemId]
  const quantity = (existing?.quantity ?? 0) + payload.quantity
  const isNewer =
    !existing ||
    existing.lastMovementAt < event.recordedAt ||
    (existing.lastMovementAt === event.recordedAt && existing.lastMovementEventId < event.id)
  return {
    ...state,
    [payload.itemId]: {
      itemId: payload.itemId,
      quantity,
      lastMovementAt: isNewer ? event.recordedAt : existing!.lastMovementAt,
      lastMovementEventId: isNewer ? event.id : existing!.lastMovementEventId,
    },
  }
}
export const projectStock = (events: EventEnvelope[]): StockState => events.reduce(reduceStock, {})
