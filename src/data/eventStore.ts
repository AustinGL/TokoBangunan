import { db, type QuarantineRow } from './db'
import { classifyEvent, type EventEnvelope } from '../domain/events'
import { newEventId } from '../domain/ids'
import { compareCausal } from './eventOrder'
import { projectItems, reduceItems } from '../domain/projections/items'
import { projectStock, reduceStock, type StockState } from '../domain/projections/stock'
import { projectSales, reduceSales } from '../domain/projections/sales'
import { projectBarang, reduceBarang } from '../domain/projections/barang'
import { projectSuppliers, reduceSuppliers } from '../domain/projections/suppliers'
import { projectBatches, reduceBatches, type BatchesState } from '../domain/projections/batches'
import { projectKategori, reduceKategori } from '../domain/projections/kategori'
import { projectCustomers, reduceCustomers } from '../domain/projections/customers'
import { projectPayments, reducePayments } from '../domain/projections/payments'
import { projectToko, reduceToko } from '../domain/projections/toko'
import { projectExpenses, reduceExpenses } from '../domain/projections/expenses'

const CURSOR_KEY = 'syncCursor'

/**
 * Applies one locally-authored event to the projection row(s) it addresses,
 * in place, instead of rebuilding the whole projection from the log. Each
 * branch reads the one existing row the event addresses (if any), calls the
 * matching pure reducer against a one-key slice of state, and writes the
 * single resulting row back - except StockReceived, whose lines can each
 * touch a different item and a different batch in one event, so that case
 * reads/writes the full set of keys its own lines mention.
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
      const payload = event.payload as { itemId: string; batchId?: string }
      const existingStock = await db.stokProj.get(payload.itemId)
      const stockState = existingStock ? { [payload.itemId]: existingStock } : {}
      const nextStock = reduceStock(stockState, event)[payload.itemId]
      if (nextStock) await db.stokProj.put(nextStock)

      if (payload.batchId) {
        const existingBatch = await db.batchesProj.get(payload.batchId)
        // No existing row: reduceBatches would drop this event anyway (see
        // batches.ts's own doc comment), so skip the read/write for the
        // same outcome without a wasted call.
        if (existingBatch) {
          const nextBatch = reduceBatches({ [payload.batchId]: existingBatch }, event)[payload.batchId]
          if (nextBatch) await db.batchesProj.put(nextBatch)
        }
      }
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
    case 'BarangUpserted': {
      const payload = event.payload as { id: string }
      const existing = await db.barangProj.get(payload.id)
      const state = existing ? { [payload.id]: existing } : {}
      const next = reduceBarang(state, event)[payload.id]
      if (next) await db.barangProj.put(next)
      return
    }
    case 'SupplierUpserted': {
      const payload = event.payload as { id: string }
      const existing = await db.suppliersProj.get(payload.id)
      const state = existing ? { [payload.id]: existing } : {}
      const next = reduceSuppliers(state, event)[payload.id]
      if (next) await db.suppliersProj.put(next)
      return
    }
    case 'KategoriUpserted': {
      const payload = event.payload as { id: string }
      const existing = await db.kategoriProj.get(payload.id)
      const state = existing ? { [payload.id]: existing } : {}
      const next = reduceKategori(state, event)[payload.id]
      if (next) await db.kategoriProj.put(next)
      return
    }
    case 'StockReceived': {
      const payload = event.payload as { lines: Array<{ batchId: string; itemId: string; qty: number }> }

      const itemIds = [...new Set(payload.lines.map(l => l.itemId))]
      const existingLevels = await db.stokProj.bulkGet(itemIds)
      const stockState: StockState = {}
      itemIds.forEach((id, i) => {
        const row = existingLevels[i]
        if (row) stockState[id] = row
      })
      await db.stokProj.bulkPut(Object.values(reduceStock(stockState, event)))

      const batchIds = [...new Set(payload.lines.map(l => l.batchId))]
      const existingBatches = await db.batchesProj.bulkGet(batchIds)
      const batchState: BatchesState = {}
      batchIds.forEach((id, i) => {
        const row = existingBatches[i]
        if (row) batchState[id] = row
      })
      await db.batchesProj.bulkPut(Object.values(reduceBatches(batchState, event)))
      return
    }
    case 'BatchCorrected': {
      const payload = event.payload as { batchId: string }
      const existing = await db.batchesProj.get(payload.batchId)
      if (!existing) return // reduceBatches drops a correction for an unknown batch
      const next = reduceBatches({ [payload.batchId]: existing }, event)[payload.batchId]
      if (next) await db.batchesProj.put(next)
      return
    }
    case 'CustomerUpserted': {
      const payload = event.payload as { id: string }
      const existing = await db.customersProj.get(payload.id)
      const state = existing ? { [payload.id]: existing } : {}
      const next = reduceCustomers(state, event)[payload.id]
      if (next) await db.customersProj.put(next)
      return
    }
    case 'TokoDiatur': {
      const existing = await db.tokoProj.get('toko')
      const next = reduceToko(existing ? { toko: existing } : {}, event).toko
      if (next) await db.tokoProj.put(next)
      return
    }
    case 'PaymentReceived': {
      const existing = await db.paymentsProj.get(event.id)
      const state = existing ? { [event.id]: existing } : {}
      const next = reducePayments(state, event)[event.id]
      if (next) await db.paymentsProj.put(next)
      return
    }
    case 'ExpenseRecorded': {
      const existing = await db.expensesProj.get(event.id)
      const state = existing ? { [event.id]: existing } : {}
      const next = reduceExpenses(state, event)[event.id]
      if (next) await db.expensesProj.put(next)
      return
    }
    case 'ExpenseVoided': {
      const { expenseId } = event.payload as { expenseId: string }
      const existing = await db.expensesProj.get(expenseId)
      if (!existing) return // reduceExpenses ignores a void for an unknown expense
      const next = reduceExpenses({ [expenseId]: existing }, event)[expenseId]
      if (next) await db.expensesProj.put(next)
      return
    }
    case 'ReminderSent':
      // No projection: Piutang reads these straight from the log (domain/pengingatLog.ts).
      return
    default:
      // Every known event schema has a case above.
      return
  }
}

export const appendEvents = async (events: EventEnvelope[]): Promise<void> => {
  if (events.length === 0) return
  await db.transaction(
    'rw',
    [db.events, db.outbox, db.itemsProj, db.stokProj, db.salesProj, db.barangProj, db.suppliersProj, db.batchesProj, db.kategoriProj, db.customersProj, db.paymentsProj, db.tokoProj, db.expensesProj],
    async () => {
      await db.events.bulkAdd(events)
      await db.outbox.bulkPut(events.map(e => ({ id: e.id })))
      for (const event of events) await foldIncremental(event)
    },
  )
}

/**
 * Correctness for two events with an identical recordedAt, or with
 * recordedAt values that disagree with causal order across devices, comes
 * from compareCausal - not from Dexie's own storage order. See
 * eventOrder.ts.
 */
export const getAllEvents = async (): Promise<EventEnvelope[]> => {
  const events = await db.events.toArray()
  return events.sort(compareCausal)
}

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

const rebuildBarangProj = async (events: EventEnvelope[]): Promise<void> => {
  const barang = projectBarang(events)
  await db.barangProj.clear()
  await db.barangProj.bulkPut(Object.values(barang))
}

const rebuildSuppliersProj = async (events: EventEnvelope[]): Promise<void> => {
  const suppliers = projectSuppliers(events)
  await db.suppliersProj.clear()
  await db.suppliersProj.bulkPut(Object.values(suppliers))
}

const rebuildBatchesProj = async (events: EventEnvelope[]): Promise<void> => {
  const batches = projectBatches(events)
  await db.batchesProj.clear()
  await db.batchesProj.bulkPut(Object.values(batches))
}

const rebuildKategoriProj = async (events: EventEnvelope[]): Promise<void> => {
  const kategori = projectKategori(events)
  await db.kategoriProj.clear()
  await db.kategoriProj.bulkPut(Object.values(kategori))
}

const rebuildCustomersProj = async (events: EventEnvelope[]): Promise<void> => {
  const customers = projectCustomers(events)
  await db.customersProj.clear()
  await db.customersProj.bulkPut(Object.values(customers))
}

const rebuildTokoProj = async (events: EventEnvelope[]): Promise<void> => {
  const toko = projectToko(events)
  await db.tokoProj.clear()
  await db.tokoProj.bulkPut(Object.values(toko))
}

const rebuildPaymentsProj = async (events: EventEnvelope[]): Promise<void> => {
  const payments = projectPayments(events)
  await db.paymentsProj.clear()
  await db.paymentsProj.bulkPut(Object.values(payments))
}

const rebuildExpensesProj = async (events: EventEnvelope[]): Promise<void> => {
  const expenses = projectExpenses(events)
  await db.expensesProj.clear()
  await db.expensesProj.bulkPut(Object.values(expenses))
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
  await db.transaction(
    'rw',
    [db.events, db.itemsProj, db.stokProj, db.salesProj, db.barangProj, db.suppliersProj, db.batchesProj, db.kategoriProj, db.customersProj, db.paymentsProj, db.tokoProj, db.expensesProj],
    async () => {
      const events = await getAllEvents()
      await rebuildItemsProj(events)
      await rebuildStokProj(events)
      await rebuildSalesProj(events)
      await rebuildBarangProj(events)
      await rebuildSuppliersProj(events)
      await rebuildBatchesProj(events)
      await rebuildKategoriProj(events)
      await rebuildCustomersProj(events)
      await rebuildPaymentsProj(events)
      await rebuildTokoProj(events)
      await rebuildExpensesProj(events)
    },
  )
}
