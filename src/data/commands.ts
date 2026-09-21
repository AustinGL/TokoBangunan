import { appendEvents } from './eventStore'
import { createEvent, type EventEnvelope } from '../domain/events'
import { newEventId } from '../domain/ids'
import { toBase } from '../domain/quantity'
import type { Clock } from '../domain/clock'

/**
 * Orchestration layer: assembles the event(s) a user action produces and
 * hands them to appendEvents in one atomic write. Event-shape logic itself
 * stays in domain/events.ts (createEvent), so this file only sequences and
 * persists. Both stok/ and kasir/ features import from here; no feature
 * imports another feature's internals.
 */

export type CommandContext = { clock: Clock; deviceId: string }

export type RecordItemInput = {
  nama: string
  baseUnit: string
  hargaEceran: number
  stokMinimum: number
  barcode?: string
  kategori?: string
  /** Whole units of baseUnit, e.g. 50 for "50 sak". Not milli-units. */
  stokAwal?: number
}

/**
 * Creates a new item and, if a starting count was given, its opening stock
 * movement, as one atomic write. Generates the item id itself (newEventId,
 * the same client-side UUIDv7 generator event ids use) since an offline
 * device has no other id source. units is always derived as
 * [{ unit: baseUnit, factor: 1 }]; this phase never asks for a multi-satuan
 * configuration.
 */
export const recordItem = async (input: RecordItemInput, ctx: CommandContext): Promise<string> => {
  const id = newEventId()
  const units = [{ unit: input.baseUnit, factor: 1 }]

  const itemEvent = createEvent('ItemUpserted', {
    id,
    nama: input.nama,
    baseUnit: input.baseUnit,
    units,
    hargaEceran: input.hargaEceran,
    stokMinimum: input.stokMinimum,
    barcode: input.barcode,
    kategori: input.kategori,
  }, ctx)

  const events: EventEnvelope[] = [itemEvent]

  // stockAdjustedSchema rejects quantity === 0, and a negative starting
  // count is nonsensical for a brand-new item, so the event is only built
  // when stokAwal is a positive number. The form is the validation
  // boundary for its sign; this only decides whether to emit the event.
  if (input.stokAwal !== undefined && input.stokAwal > 0) {
    const stockEvent = createEvent('StockAdjusted', {
      itemId: id,
      // Reuses toBase rather than hand-writing stokAwal * 1000, matching the
      // "same function that computed the stock movement" rule even though
      // the base-unit factor is trivially 1 here.
      quantity: toBase(input.stokAwal, { unit: input.baseUnit, factor: 1 }),
      reason: 'initial',
    }, ctx)
    events.push(stockEvent)
  }

  await appendEvents(events)
  return id
}
