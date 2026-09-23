import { db, type QuarantineRow } from './db'
import { classifyEvent, type EventEnvelope } from '../domain/events'
import { newEventId } from '../domain/ids'
import { projectItems, reduceItems } from '../domain/projections/items'
import { projectStock, reduceStock } from '../domain/projections/stock'
import { projectSales, reduceSales } from '../domain/projections/sales'

const CURSOR_KEY = 'syncCursor'

/**
 * Applies one locally-authored event to the projection row(s) it addresses,
 * in place, instead of rebuilding the whole projection from the log. Each
 * branch reads the one existing row the event addresses (if any), calls the
 * matching pure reducer against a one-key slice of state, and writes the
 * single resulting row back.
 *
 * Valid only under the same assumption reduceItems's single-event LWW check
 * already makes: events are locally authored and appended in non-decreasing
 * recordedAt order, on one device. Must never run on the remote-pull path
 * (see applyRemoteEvents, which relies on rebuildProjections instead, since a
 * pulled page can legitimately contain an event older than what this device
 * already folded).
 */
const foldIncremental = async (event: EventEnvelope): Promise<void> => {
  switch (event.type) {
    case 'ItemUpserted': {
      const payload = event.payload as { id: string }
      const existing = await db.itemsProj.get(payload.id)
      const state = existing ? { [payload.id]: existing } : {}
      const next = reduceItems(state, event)[payload.id]
      if (next) await db.itemsProj.put(next)
      return
    }
    case 'StockAdjusted': {
      const payload = event.payload as { itemId: string }
      const existing = await db.stokProj.get(payload.itemId)
      const state = existing ? { [payload.itemId]: existing } : {}
      const next = reduceStock(state, event)[payload.itemId]
      if (next) await db.stokProj.put(next)
      return
    }
    case 'SaleRecorded': {
      const existing = await db.salesProj.get(event.id)
      const state = existing ? { [event.id]: existing } : {}
      const next = reduceSales(state, event)[event.id]
      if (next) await db.salesProj.put(next)
      return
    }
    case 'SaleVoided': {
      // Patched by a FOREIGN key (payload.saleId), not this event's own id:
      // see reduceSales's doc comment for why no tie-break is needed here.
      const payload = event.payload as { saleId: string }
      const existing = await db.salesProj.get(payload.saleId)
      const state = existing ? { [payload.saleId]: existing } : {}
      const next = reduceSales(state, event)[payload.saleId]
      if (next) await db.salesProj.put(next)
      return
    }
    default:
      // Every known event schema has a case above. Later tasks add their
      // own case above as their event type and projection module land.
      return
  }
}

export const appendEvents = async (events: EventEnvelope[]): Promise<void> => {
  if (events.length === 0) return
  await db.transaction('rw', db.events, db.outbox, db.itemsProj, db.stokProj, db.salesProj, async () => {
    await db.events.bulkAdd(events)
    await db.outbox.bulkPut(events.map(e => ({ id: e.id })))
    for (const event of events) await foldIncremental(event)
  })
}

/**
 * Correctness for two events with an identical recordedAt comes from the
 * deterministic tie-break inside projectItems (by event id), not from this
 * query's ordering. Do not rely on Dexie's tie-break here for correctness.
 */
export const getAllEvents = (): Promise<EventEnvelope[]> =>
  db.events.orderBy('recordedAt').toArray()

export const getUnsyncedEvents = async (): Promise<EventEnvelope[]> => {
  const ids = await db.outbox.toArray()
  if (ids.length === 0) return []
  const events = await db.events.bulkGet(ids.map(r => r.id))
  return events.filter((e): e is EventEnvelope => e !== undefined)
}

export const markSynced = async (assignments: Array<{ id: string; serverSeq: number }>): Promise<void> => {
  await db.transaction('rw', db.events, db.outbox, async () => {
    for (const { id, serverSeq } of assignments) {
      await db.events.update(id, { serverSeq })
      await db.outbox.delete(id)
    }
  })
}

export type ApplyResult = {
  /** Events written to the log. */
  applied: number
  /** Records this version could not parse, stored in the quarantine table. */
  quarantined: number
}

const quarantineKey = (raw: unknown): string => {
  const id = (raw as { id?: unknown } | null)?.id
  return typeof id === 'string' && id.length > 0 ? id : `unkeyed-${newEventId()}`
}

/**
 * Validates before writing: sync input is untrusted input.
 *
 * Partitions rather than throwing. The log is append-only and shared between
 * devices on different releases, so a single record this version cannot parse
 * is an expected condition, not a catastrophe: throwing here would leave the
 * cursor un-advanced and make every later sync refetch and rethrow on the same
 * page forever. Unparseable records are kept verbatim in the quarantine table
 * and retried by promoteQuarantined once the app knows how to read them.
 */
export const applyRemoteEvents = async (raw: unknown[]): Promise<ApplyResult> => {
  const valid: EventEnvelope[] = []
  const rejected: QuarantineRow[] = []
  const quarantinedAt = new Date().toISOString()

  for (const row of raw) {
    const result = classifyEvent(row)
    if (result.status === 'valid') {
      valid.push(result.event)
      continue
    }
    rejected.push({ key: quarantineKey(row), raw: row, reason: result.reason, quarantinedAt })
  }

  await db.transaction('rw', db.events, db.quarantine, db.outbox, async () => {
    if (valid.length > 0) {
      await db.events.bulkPut(valid)
      // A pulled event always carries a real serverSeq, so it is either
      // brand new to this device, or it is this device's own event coming
      // back around after a push whose ack was lost (the retry then hit
      // ON CONFLICT (id) DO NOTHING on the server, so markSynced never ran
      // and the outbox row survived). Either way, once an event has a real
      // serverSeq, its outbox row (if any) is stale and must go, or it
      // would be re-pushed forever, inflating getUnsyncedEvents() and the
      // "belum tersinkron (n)" count in violation of the outbox <=>
      // serverSeq === null invariant.
      await db.outbox.bulkDelete(valid.map(e => e.id))
    }
    if (rejected.length > 0) await db.quarantine.bulkPut(rejected)
  })

  if (rejected.length > 0) {
    // Observable rather than silent: a wedged device used to look identical to
    // a healthy one from the outside.
    console.warn(
      `Sync: ${rejected.length} event(s) quarantined, unreadable by this version.`,
      rejected.map(r => `${r.key}: ${r.reason}`),
    )
  }

  return { applied: valid.length, quarantined: rejected.length }
}

/**
 * Re-parses quarantined records against the current schemas and moves the ones
 * that now validate into the log. This is what makes quarantine a delay rather
 * than a loss: a Phase 1 phone stores a Phase 2 event it cannot read, and the
 * moment that phone updates, the event is promoted and projected with no
 * re-pull and no user action.
 */
export const promoteQuarantined = async (): Promise<number> => {
  const rows = await db.quarantine.toArray()
  if (rows.length === 0) return 0

  const promoted: EventEnvelope[] = []
  const keys: string[] = []
  for (const row of rows) {
    const result = classifyEvent(row.raw)
    if (result.status !== 'valid') continue
    promoted.push(result.event)
    keys.push(row.key)
  }
  if (promoted.length === 0) return 0

  await db.transaction('rw', db.events, db.quarantine, async () => {
    await db.events.bulkPut(promoted)
    await db.quarantine.bulkDelete(keys)
  })
  return promoted.length
}

export const getQuarantined = (): Promise<QuarantineRow[]> => db.quarantine.toArray()

export const getCursor = async (): Promise<number> => {
  const row = await db.meta.get(CURSOR_KEY)
  return (row?.value as number | undefined) ?? 0
}

export const setCursor = async (seq: number): Promise<void> => {
  await db.meta.put({ key: CURSOR_KEY, value: seq })
}

const rebuildItemsProj = async (events: EventEnvelope[]): Promise<void> => {
  const items = projectItems(events)
  await db.itemsProj.clear()
  await db.itemsProj.bulkPut(Object.values(items))
}

const rebuildStokProj = async (events: EventEnvelope[]): Promise<void> => {
  const stock = projectStock(events)
  await db.stokProj.clear()
  await db.stokProj.bulkPut(Object.values(stock))
}

const rebuildSalesProj = async (events: EventEnvelope[]): Promise<void> => {
  const sales = projectSales(events)
  await db.salesProj.clear()
  await db.salesProj.bulkPut(Object.values(sales))
}

/**
 * Projections are a cache. Discarding and rebuilding must always produce
 * identical state, which the test suite asserts.
 *
 * One rebuild step per known projection.
 */
export const rebuildProjections = async (): Promise<void> => {
  // The read used to happen in its own transaction OUTSIDE the
  // clear-and-rewrite transaction below. IndexedDB queues overlapping
  // transactions in creation order but does not interleave them, so a local
  // appendEvents call that was requested after this read but committed
  // before the clear-and-rewrite transaction started could vanish: the
  // rebuild would then clear the projections and rewrite them from a
  // snapshot that predates the new event. Reading db.events inside the same
  // 'rw' transaction as the rewrite makes the whole rebuild one atomic unit,
  // so a concurrent appendEvents transaction is fully ordered either before
  // (and this read sees it) or after (and it folds on top afterward) -
  // never lost in between.
  await db.transaction('rw', db.events, db.itemsProj, db.stokProj, db.salesProj, async () => {
    const events = await getAllEvents()
    await rebuildItemsProj(events)
    await rebuildStokProj(events)
    await rebuildSalesProj(events)
  })
}
