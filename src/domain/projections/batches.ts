import type { EventEnvelope } from '../events'

export type Batch = {
  batchId: string
  itemId: string
  supplierId?: string
  hargaBeli?: number
  hargaJual: number
  tanggalBeli: string
  /** The batch's own recorded "originally received" quantity (milli-units), for display (Riwayat stok's own "Beli" column) - correctable via BatchCorrected's own jumlah field. Distinct from sisa: correcting diterima does not by itself change sisa. */
  diterima: number
  /** Running total: the StockReceived line's own qty, plus every signed StockAdjusted folded against this batchId since (sale negative, void positive, koreksi whatever signed delta the correction specifies). */
  sisa: number
  /** recordedAt/id of the last metadata write (the original StockReceived line, or a later BatchCorrected), for BatchCorrected's last-write-wins. */
  metaUpdatedAt: string
  metaUpdatedByEventId: string
  /** recordedAt/id of the last sisa-changing movement, audit-only, mirrors stock.ts's own lastMovementAt. */
  lastMovementAt: string
  lastMovementEventId: string
}
export type BatchesState = Record<string, Batch>

function isNewer(existingAt: string, existingId: string, event: EventEnvelope): boolean {
  return existingAt < event.recordedAt || (existingAt === event.recordedAt && existingId < event.id)
}

/**
 * StockReceived creates the batch row (metadata plus the initial sisa/
 * diterima). StockAdjusted with a batchId (sale, void, koreksi) only moves
 * sisa - and is dropped, not crashed on, if this device has never folded a
 * StockReceived for that batchId. That is a real, reachable case, not just
 * a corrupted-log fallback: this projection is not yet wired into
 * eventStore.ts (Task 7), and once it is, rebuildProjections()'s
 * recordedAt-ordered fold can genuinely see a batch's movement before its
 * StockReceived when devices' clocks disagree (e.g. laptop receives a
 * batch at 10:00 by its own clock, a phone running a few minutes behind
 * sells from it and records the sale at 09:59). Task 7 must sort the
 * rebuild causally (by serverSeq, nulls last, before recordedAt/id) so a
 * device only ever folds a batch's movements after that device has itself
 * pulled the StockReceived - not by recordedAt alone. BatchCorrected overwrites metadata
 * (last-write-wins) and, only when it carries a jumlah, also corrects
 * diterima for display - never sisa, which only a companion
 * StockAdjusted('koreksi') can change, by its own explicit signed delta.
 */
export function reduceBatches(state: BatchesState, event: EventEnvelope): BatchesState {
  if (event.type === 'StockReceived') {
    const payload = event.payload as {
      supplierId?: string
      lines: Array<{ batchId: string; itemId: string; qty: number; hargaBeli?: number; hargaJual: number }>
    }
    return payload.lines.reduce((next, line) => {
      const existing = next[line.batchId]
      const metaIsNewer = !existing || isNewer(existing.metaUpdatedAt, existing.metaUpdatedByEventId, event)
      const movementIsNewer = !existing || isNewer(existing.lastMovementAt, existing.lastMovementEventId, event)
      return {
        ...next,
        [line.batchId]: {
          batchId: line.batchId,
          itemId: line.itemId,
          supplierId: metaIsNewer ? payload.supplierId : existing?.supplierId,
          hargaBeli: metaIsNewer ? line.hargaBeli : existing?.hargaBeli,
          hargaJual: metaIsNewer ? line.hargaJual : existing!.hargaJual,
          tanggalBeli: metaIsNewer ? event.occurredAt : existing!.tanggalBeli,
          diterima: (existing?.diterima ?? 0) + line.qty,
          sisa: (existing?.sisa ?? 0) + line.qty,
          metaUpdatedAt: metaIsNewer ? event.recordedAt : existing!.metaUpdatedAt,
          metaUpdatedByEventId: metaIsNewer ? event.id : existing!.metaUpdatedByEventId,
          lastMovementAt: movementIsNewer ? event.recordedAt : existing!.lastMovementAt,
          lastMovementEventId: movementIsNewer ? event.id : existing!.lastMovementEventId,
        },
      }
    }, state)
  }

  if (event.type === 'StockAdjusted') {
    const payload = event.payload as { quantity: number; batchId?: string }
    if (!payload.batchId) return state
    const existing = state[payload.batchId]
    if (!existing) return state
    const movementIsNewer = isNewer(existing.lastMovementAt, existing.lastMovementEventId, event)
    return {
      ...state,
      [payload.batchId]: {
        ...existing,
        sisa: existing.sisa + payload.quantity,
        lastMovementAt: movementIsNewer ? event.recordedAt : existing.lastMovementAt,
        lastMovementEventId: movementIsNewer ? event.id : existing.lastMovementEventId,
      },
    }
  }

  if (event.type === 'BatchCorrected') {
    const payload = event.payload as {
      batchId: string; supplierId?: string; hargaBeli?: number; hargaJual: number; tanggalBeli: string; jumlah?: number
    }
    const existing = state[payload.batchId]
    if (!existing) return state
    if (!isNewer(existing.metaUpdatedAt, existing.metaUpdatedByEventId, event)) return state
    return {
      ...state,
      [payload.batchId]: {
        ...existing,
        supplierId: payload.supplierId,
        hargaBeli: payload.hargaBeli,
        hargaJual: payload.hargaJual,
        tanggalBeli: payload.tanggalBeli,
        diterima: payload.jumlah ?? existing.diterima,
        metaUpdatedAt: event.recordedAt,
        metaUpdatedByEventId: event.id,
      },
    }
  }

  return state
}

export const projectBatches = (events: EventEnvelope[]): BatchesState => events.reduce(reduceBatches, {})
