import type { EventEnvelope } from '../domain/events'

/**
 * Sorts events into the order they can be safely folded in, for any
 * projection whose reducer depends on one event's existence implying an
 * earlier one already folded (batches.ts's StockAdjusted/BatchCorrected
 * branches). recordedAt alone is unsound across devices: a device can only
 * ever author an event referencing another's subject after pulling that
 * other event, and once both are synced, the referencing event always
 * carries the greater serverSeq - regardless of how the two devices'
 * clocks disagree. serverSeq null (this device's own not-yet-synced
 * writes) sorts after every synced event, and among themselves by the
 * same recordedAt/id tie-break every last-write-wins reducer already uses.
 */
export function compareCausal(a: EventEnvelope, b: EventEnvelope): number {
  if (a.serverSeq !== null && b.serverSeq !== null) return a.serverSeq - b.serverSeq
  if (a.serverSeq !== null) return -1
  if (b.serverSeq !== null) return 1
  if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
