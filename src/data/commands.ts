import { appendEvents } from './eventStore'
import { createEvent, type EventEnvelope } from '../domain/events'
import { newEventId } from '../domain/ids'
import { toBase } from '../domain/quantity'
import { add, rupiah, subtract, type Rupiah } from '../domain/money'
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

/**
 * A cart line as commands.ts needs it: structurally what useCart.ts's
 * CartLine produces (plus, harmlessly, any extra fields on that type -
 * TypeScript's structural typing accepts a CartLine[] argument here without
 * a cast). Kept as this file's own type, not an import from features/kasir,
 * since data/ is a lower layer than features/ (see this file's own doc
 * comment above: features import commands.ts, not the reverse).
 */
export type RecordSaleLine = {
  itemId: string
  nama: string
  unit: string
  /** Milli-units of `unit`, per quantity.ts. Positive: a cart holds what is being sold, not the stock delta. */
  qty: number
  hargaSatuan: number
  subtotal: number
}

export type RecordSaleInput = {
  lines: RecordSaleLine[]
  /** Phase 2 accepts only tunai; matches saleRecordedSchema's narrower enum. */
  metodeBayar: 'tunai'
  uangDiterima?: number
  /** No customer picker exists yet (Task 6b territory); always undefined this phase. */
  customerId?: string
}

/**
 * Records a sale and its stock deduction as one atomic write: one
 * SaleRecorded event plus one StockAdjusted('sale') event per cart line,
 * all in a single appendEvents call. Assumes cart.lines has at least one
 * line, the same way recordItem assumes its caller already validated
 * required fields -- CartPanel (Task 6b) disables its save action on an
 * empty cart, so an empty-cart call is unreachable from the UI rather than
 * defended against here (saleLineSchema's array also has .min(1) and would
 * reject it regardless).
 */
export const recordSale = async (cart: RecordSaleInput, ctx: CommandContext): Promise<string> => {
  const subtotal = cart.lines.reduce(
    (sum, line) => add(sum, rupiah(line.subtotal)),
    rupiah(0),
  )
  const diskon: Rupiah = rupiah(0)
  const total = subtract(subtotal, diskon)

  const saleEvent = createEvent('SaleRecorded', {
    lines: cart.lines,
    metodeBayar: cart.metodeBayar,
    subtotal,
    diskon,
    total,
    uangDiterima: cart.uangDiterima,
    customerId: cart.customerId,
    deliveryIntent: 'dibawa',
  }, ctx)

  // One StockAdjusted per line, quantity negated: the cart line's own qty is
  // a positive milli-quantity (what was sold), but a sale deducts stock.
  const stockEvents: EventEnvelope[] = cart.lines.map(line =>
    createEvent('StockAdjusted', {
      itemId: line.itemId,
      quantity: -line.qty,
      reason: 'sale',
      saleId: saleEvent.id,
    }, ctx),
  )

  await appendEvents([saleEvent, ...stockEvents])
  return saleEvent.id
}
