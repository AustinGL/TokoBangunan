import type { EventEnvelope } from '../events'

export type StockLevel = {
  itemId: string
  quantity: number            // running total, milli-units of baseUnit
  lastMovementAt: string
  lastMovementEventId: string
}
export type StockState = Record<string, StockLevel>

function creditItem(state: StockState, itemId: string, delta: number, event: EventEnvelope): StockState {
  const existing = state[itemId]
  const quantity = (existing?.quantity ?? 0) + delta
  const isNewer =
    !existing ||
    existing.lastMovementAt < event.recordedAt ||
    (existing.lastMovementAt === event.recordedAt && existing.lastMovementEventId < event.id)
  return {
    ...state,
    [itemId]: {
      itemId,
      quantity,
      lastMovementAt: isNewer ? event.recordedAt : existing!.lastMovementAt,
      lastMovementEventId: isNewer ? event.id : existing!.lastMovementEventId,
    },
  }
}

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
 *
 * StockReceived credits every line's item the same way an 'initial'
 * StockAdjusted always has - a tracked purchase needs no separate,
 * redundant StockAdjusted event to also update the aggregate.
 */
export function reduceStock(state: StockState, event: EventEnvelope): StockState {
  if (event.type === 'StockReceived') {
    const payload = event.payload as { lines: Array<{ itemId: string; qty: number }> }
    return payload.lines.reduce((acc, line) => creditItem(acc, line.itemId, line.qty, event), state)
  }

  if (event.type !== 'StockAdjusted') return state
  const payload = event.payload as { itemId: string; quantity: number }
  return creditItem(state, payload.itemId, payload.quantity, event)
}

export const projectStock = (events: EventEnvelope[]): StockState => events.reduce(reduceStock, {})
