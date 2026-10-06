import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import {
  appendEvents, getUnsyncedEvents, markSynced, getAllEvents,
  applyRemoteEvents, getCursor, setCursor, rebuildProjections,
  promoteQuarantined, getQuarantined,
} from './eventStore'
import { createEvent, type EventEnvelope } from '../domain/events'
import { fixedClock } from '../domain/clock'

const item = (id: string, harga: number) => ({
  id, nama: `Item ${id}`, baseUnit: 'sak',
  units: [{ unit: 'sak', factor: 1 }], hargaEceran: harga, stokMinimum: 0,
})
const adjust = (itemId: string, quantity: number) => ({ itemId, quantity, reason: 'initial' as const })
const sale = (itemId: string, total: number) => ({
  lines: [{ itemId, nama: `Item ${itemId}`, unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
  metodeBayar: 'tunai' as const,
  subtotal: total,
  diskon: 0,
  total,
})
const voidSale = (saleId: string, alasan: string) => ({ saleId, alasan })
const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })
const received = (batchId: string, itemId: string, qty: number, extra: Partial<{ supplierId: string; hargaBeli: number; hargaJual: number }> = {}) => ({
  supplierId: extra.supplierId ?? 'sup-1',
  lines: [{ batchId, itemId, qty, hargaBeli: extra.hargaBeli ?? 60000, hargaJual: extra.hargaJual ?? 67000 }],
})
const barang = (id: string, nama: string) => ({ id, nama })
const supplier = (id: string, nama: string) => ({ id, nama })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('event store', () => {
  it('appends and reads back', async () => {
    const e = createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    expect(await getAllEvents()).toHaveLength(1)
  })

  it('reports unsynced events', async () => {
    await appendEvents([createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z'))])
    await appendEvents([createEvent('ItemUpserted', item('b', 200), at('2026-09-18T07:01:00.000Z'))])
    expect(await getUnsyncedEvents()).toHaveLength(2)
  })

  it('stops reporting events once marked synced', async () => {
    const e = createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    await markSynced([{ id: e.id, serverSeq: 1 }])
    expect(await getUnsyncedEvents()).toHaveLength(0)
  })

  it('tracks unsynced ids in the outbox table', async () => {
    const a = createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z'))
    const b = createEvent('ItemUpserted', item('b', 200), at('2026-09-18T07:01:00.000Z'))
    await appendEvents([a, b])
    await markSynced([{ id: a.id, serverSeq: 1 }])

    expect(await db.outbox.toArray()).toEqual([{ id: b.id }])
  })

  it('is idempotent when the same remote event arrives twice', async () => {
    const e = { ...createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z')), serverSeq: 7 }
    await applyRemoteEvents([e])
    await applyRemoteEvents([e])
    expect(await getAllEvents()).toHaveLength(1)
  })

  it('quarantines a malformed remote event instead of writing it to the log', async () => {
    const result = await applyRemoteEvents([
      { id: 'x', type: 'NotAThing', payload: {}, occurredAt: 'a', recordedAt: 'b', deviceId: 'd', serverSeq: 1 },
    ])

    expect(result).toEqual({ applied: 0, quarantined: 1 })
    expect(await getAllEvents()).toHaveLength(0)
    expect(await getQuarantined()).toHaveLength(1)
  })

  it('projects a locally appended event without waiting for a sync', async () => {
    // appendEvent used to write the log and nothing else, and
    // rebuildProjections ran only inside runSync. A sale recorded on the
    // counter laptop would therefore stay invisible in the read model until
    // an unrelated remote event happened to arrive.
    await appendEvents([createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))])

    expect(await db.itemsProj.get('semen')).toMatchObject({ id: 'semen', hargaEceran: 52000 })
  })

  it('tracks the sync cursor, starting at zero', async () => {
    expect(await getCursor()).toBe(0)
    await setCursor(42)
    expect(await getCursor()).toBe(42)
  })
})

describe('appendEvents incremental fold', () => {
  it('is a safe no-op for an empty array', async () => {
    await appendEvents([])
    expect(await getAllEvents()).toHaveLength(0)
    expect(await db.itemsProj.toArray()).toHaveLength(0)
  })

  it('produces the same itemsProj row as rebuildProjections for a brand new item', async () => {
    const e = createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    const incremental = await db.itemsProj.toArray()

    await db.itemsProj.clear()
    await rebuildProjections()
    const rebuilt = await db.itemsProj.toArray()

    expect(incremental).toEqual(rebuilt)
    expect(incremental).toHaveLength(1)
    expect(incremental[0]).toMatchObject({ id: 'semen', hargaEceran: 52000 })
  })

  it('produces the same itemsProj row as rebuildProjections when a later recordedAt updates an existing item', async () => {
    const first = createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('ItemUpserted', item('semen', 54000), at('2026-09-18T07:05:00.000Z'))
    await appendEvents([first])
    await appendEvents([second])
    const incremental = await db.itemsProj.toArray()

    await db.itemsProj.clear()
    await rebuildProjections()
    const rebuilt = await db.itemsProj.toArray()

    expect(incremental).toEqual(rebuilt)
    expect(incremental).toHaveLength(1)
    // The later recordedAt wins, matching reduceItems's last-write-wins rule.
    expect(incremental[0].hargaEceran).toBe(54000)
  })

  it('resolves a tied recordedAt on the same item deterministically, matching rebuildProjections', async () => {
    const first = createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('ItemUpserted', item('semen', 54000), at('2026-09-18T07:00:00.000Z'))
    expect(second.id > first.id).toBe(true)

    await appendEvents([first])
    await appendEvents([second])
    const incremental = await db.itemsProj.toArray()

    await db.itemsProj.clear()
    await rebuildProjections()
    const rebuilt = await db.itemsProj.toArray()

    expect(incremental).toEqual(rebuilt)
    expect(incremental).toHaveLength(1)
    // The event with the greater id (minted later) wins the tie, same
    // tie-break reduceItems applies during a rebuild.
    expect(incremental[0].hargaEceran).toBe(54000)
  })

  it('produces the same stokProj row as rebuildProjections for accumulated StockAdjusted events', async () => {
    const first = createEvent('StockAdjusted', adjust('semen', 10), at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('StockAdjusted', adjust('semen', -3), at('2026-09-18T07:01:00.000Z'))
    await appendEvents([first])
    await appendEvents([second])
    const incremental = await db.stokProj.toArray()

    await db.stokProj.clear()
    await rebuildProjections()
    const rebuilt = await db.stokProj.toArray()

    expect(incremental).toEqual(rebuilt)
    expect(incremental).toHaveLength(1)
    expect(incremental[0]).toMatchObject({ itemId: 'semen', quantity: 7 })
  })

  it('produces the same salesProj row as rebuildProjections for a SaleRecorded followed by a SaleVoided in a separate append', async () => {
    // Specifically exercises the patch-by-foreign-key wiring in
    // foldIncremental: the SaleVoided case must look up and write back
    // db.salesProj keyed by payload.saleId, not the void event's own id.
    const recorded = createEvent('SaleRecorded', sale('semen', 52000), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([recorded])
    const voided = createEvent('SaleVoided', voidSale(recorded.id, 'salah input'), at('2026-09-18T07:01:00.000Z'))
    await appendEvents([voided])
    const incremental = await db.salesProj.toArray()

    await db.salesProj.clear()
    await rebuildProjections()
    const rebuilt = await db.salesProj.toArray()

    expect(incremental).toEqual(rebuilt)
    expect(incremental).toHaveLength(1)
    expect(incremental[0]).toMatchObject({ id: recorded.id, status: 'batal', voidedReason: 'salah input' })
  })
})

describe('rebuildProjections', () => {
  it('produces identical state after the cache is discarded', async () => {
    await appendEvents([createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))])
    await appendEvents([createEvent('ItemUpserted', item('pasir', 180000), at('2026-09-18T07:01:00.000Z'))])
    await rebuildProjections()
    const first = await db.itemsProj.toArray()

    await db.itemsProj.clear()
    await rebuildProjections()
    const second = await db.itemsProj.toArray()

    expect(second).toEqual(first)
    expect(second).toHaveLength(2)
  })

  it('resolves a tied recordedAt on the same item deterministically across rebuilds', async () => {
    const first = createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('ItemUpserted', item('semen', 54000), at('2026-09-18T07:00:00.000Z'))
    expect(second.id > first.id).toBe(true)

    await appendEvents([first])
    await appendEvents([second])
    await rebuildProjections()
    const firstSnapshot = await db.itemsProj.toArray()

    await db.itemsProj.clear()
    await rebuildProjections()
    const secondSnapshot = await db.itemsProj.toArray()

    expect(secondSnapshot).toEqual(firstSnapshot)
    expect(secondSnapshot).toHaveLength(1)
    // The event with the greater id (minted later) wins the tie.
    expect(secondSnapshot[0].hargaEceran).toBe(54000)
  })

  it('rebuilds stokProj identically after the cache is discarded', async () => {
    await appendEvents([createEvent('StockAdjusted', adjust('semen', 10), at('2026-09-18T07:00:00.000Z'))])
    await appendEvents([createEvent('StockAdjusted', adjust('semen', -3), at('2026-09-18T07:01:00.000Z'))])
    await appendEvents([createEvent('StockAdjusted', adjust('pasir', 20), at('2026-09-18T07:02:00.000Z'))])
    await rebuildProjections()
    const first = await db.stokProj.toArray()

    await db.stokProj.clear()
    await rebuildProjections()
    const second = await db.stokProj.toArray()

    expect(second).toEqual(first)
    expect(second).toHaveLength(2)
  })

  it('rebuilds salesProj identically after the cache is discarded, for a recorded and voided sale', async () => {
    const recorded = createEvent('SaleRecorded', sale('semen', 52000), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([recorded])
    await appendEvents([createEvent('SaleVoided', voidSale(recorded.id, 'salah input'), at('2026-09-18T07:01:00.000Z'))])
    await rebuildProjections()
    const first = await db.salesProj.toArray()

    await db.salesProj.clear()
    await rebuildProjections()
    const second = await db.salesProj.toArray()

    expect(second).toEqual(first)
    expect(second).toHaveLength(1)
    expect(second[0]).toMatchObject({ id: recorded.id, status: 'batal' })
  })

  it('does not lose an event appended while a rebuild is in flight', async () => {
    // getAllEvents used to run in its own transaction OUTSIDE the
    // clear-and-rewrite transaction. IndexedDB queues read-write
    // transactions with overlapping scope in the order they were created,
    // but never interleaves their operations, so once db.events is part of
    // rebuildProjections's own transaction, a concurrent appendEvents call
    // is fully ordered before it (and this read sees the new event) or
    // after it (and the new event folds on top afterward) - never lost in
    // between, unlike the old two-transaction version.
    await appendEvents([createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))])
    await rebuildProjections()

    const late = createEvent('ItemUpserted', item('pasir', 180000), at('2026-09-18T07:05:00.000Z'))

    await Promise.all([rebuildProjections(), appendEvents([late])])

    const projected = await db.itemsProj.toArray()
    expect(projected.map(p => p.id).sort()).toEqual(['pasir', 'semen'])
  })
})

describe('applyRemoteEvents partitioning', () => {
  const unknownType = (id: string, recordedAt: string) => ({
    id,
    type: 'NotYetKnownType',
    payload: { total: 125000 },
    occurredAt: recordedAt,
    recordedAt,
    deviceId: 'laptop',
    serverSeq: 2,
  })

  it('applies the valid events in a batch whose middle event has an unknown type', async () => {
    // The forward-compatibility case, and the reason this cannot throw: the
    // counter laptop updates to a release that emits a new event type while
    // the phone is still on this one. An all-or-nothing map(parseEvent)
    // would throw before the bulkPut, leave the cursor un-advanced, and
    // make every later sync refetch and rethrow on the same page forever.
    // The log is append-only, so the poison row never goes away.
    const first = { ...createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z')), serverSeq: 1 }
    const third = { ...createEvent('ItemUpserted', item('c', 300), at('2026-09-18T07:02:00.000Z')), serverSeq: 3 }

    const result = await applyRemoteEvents([first, unknownType('evt-sale', '2026-09-18T07:01:00.000Z'), third])

    expect(result).toEqual({ applied: 2, quarantined: 1 })
    const stored = await getAllEvents()
    expect(stored.map(e => e.id)).toEqual([first.id, third.id])
  })

  it('stores the unreadable record verbatim, with the reason, rather than dropping it', async () => {
    const raw = unknownType('evt-sale', '2026-09-18T07:01:00.000Z')

    await applyRemoteEvents([raw])

    const [row] = await getQuarantined()
    expect(row.key).toBe('evt-sale')
    expect(row.raw).toEqual(raw)
    expect(row.reason).toContain('NotYetKnownType')
  })

  it('keys an unkeyed record so a batch of them cannot collapse into one row', async () => {
    await applyRemoteEvents([{ nothing: 'useful' }, { nothing: 'useful either' }])

    expect(await getQuarantined()).toHaveLength(2)
  })

  it('is idempotent: re-applying the same unreadable record does not duplicate it', async () => {
    const raw = unknownType('evt-sale', '2026-09-18T07:01:00.000Z')

    await applyRemoteEvents([raw])
    await applyRemoteEvents([raw])

    expect(await getQuarantined()).toHaveLength(1)
  })

  it('clears the outbox row for an event that comes back from a pull with a real serverSeq', async () => {
    // The lost-ack path the architecture doc documents: appendEvents wrote
    // the event and put it in the outbox, a push to the server succeeded,
    // but the ack never reached this device (a retried push then hits
    // ON CONFLICT (id) DO NOTHING and returns no row, so markSynced is never
    // called). The event is then pulled back with its real serverSeq on the
    // next sync, and its now-stale outbox row must be cleaned up here or it
    // would be re-pushed forever.
    const e = createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    expect(await db.outbox.toArray()).toEqual([{ id: e.id }])

    await applyRemoteEvents([{ ...e, serverSeq: 5 }])

    expect(await db.outbox.toArray()).toEqual([])
    expect((await db.events.get(e.id))?.serverSeq).toBe(5)
  })
})

describe('promoteQuarantined', () => {
  it('moves a record into the log once this version can read it, and projects it', async () => {
    // Simulates the app being updated: the record was unreadable when it
    // arrived, and parses now. Nothing is re-pulled and the user does nothing.
    const valid = createEvent('ItemUpserted', item('besi', 99000), at('2026-09-18T07:00:00.000Z'))
    const asUnknown = { ...valid, type: 'NotYetKnown' }
    await applyRemoteEvents([asUnknown])
    expect(await getAllEvents()).toHaveLength(0)

    // The "update" itself: the same record, now with a type the app knows.
    await db.quarantine.put({
      key: valid.id, raw: valid as EventEnvelope, reason: 'stale', quarantinedAt: '2026-09-18T07:00:00.000Z',
    })

    expect(await promoteQuarantined()).toBe(1)
    expect(await getAllEvents()).toHaveLength(1)
    expect(await getQuarantined()).toHaveLength(0)

    await rebuildProjections()
    expect(await db.itemsProj.get('besi')).toMatchObject({ hargaEceran: 99000 })
  })

  it('leaves a record that still does not parse in quarantine', async () => {
    await applyRemoteEvents([{ id: 'broken', type: 'Nope', payload: {}, occurredAt: 'x', recordedAt: 'y', deviceId: 'd', serverSeq: 1 }])

    expect(await promoteQuarantined()).toBe(0)
    expect(await getQuarantined()).toHaveLength(1)
  })

  it('is a no-op with an empty quarantine', async () => {
    expect(await promoteQuarantined()).toBe(0)
  })
})

describe('appendEvents incremental fold: barang, suppliers, batches', () => {
  it('produces the same barangProj row as rebuildProjections for a new BarangUpserted', async () => {
    const e = createEvent('BarangUpserted', barang('b1', 'Semen Tiga Roda'), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    const incremental = await db.barangProj.toArray()

    await db.barangProj.clear()
    await rebuildProjections()
    const rebuilt = await db.barangProj.toArray()

    expect(incremental).toEqual(rebuilt)
    expect(incremental).toHaveLength(1)
    expect(incremental[0]).toMatchObject({ id: 'b1', nama: 'Semen Tiga Roda' })
  })

  it('produces the same suppliersProj row as rebuildProjections for a new SupplierUpserted', async () => {
    const e = createEvent('SupplierUpserted', supplier('sup-1', 'CV Maju'), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    const incremental = await db.suppliersProj.toArray()

    await db.suppliersProj.clear()
    await rebuildProjections()
    const rebuilt = await db.suppliersProj.toArray()

    expect(incremental).toEqual(rebuilt)
    expect(incremental).toHaveLength(1)
    expect(incremental[0]).toMatchObject({ id: 'sup-1', nama: 'CV Maju', perluDilengkapi: false })
  })

  it('produces the same batchesProj row as rebuildProjections for a StockReceived with multiple lines', async () => {
    const e = createEvent('StockReceived', {
      supplierId: 'sup-1',
      lines: [
        { batchId: 'b1', itemId: 'semen', qty: 40000, hargaBeli: 60000, hargaJual: 67000 },
        { batchId: 'b2', itemId: 'pasir', qty: 2000, hargaJual: 180000 },
      ],
    }, at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    const incrementalBatches = await db.batchesProj.toArray()
    const incrementalStock = await db.stokProj.toArray()

    await db.batchesProj.clear()
    await db.stokProj.clear()
    await rebuildProjections()

    expect(await db.batchesProj.toArray()).toEqual(incrementalBatches)
    expect(await db.stokProj.toArray()).toEqual(incrementalStock)
    expect(incrementalBatches).toHaveLength(2)
    expect(incrementalStock.find(s => s.itemId === 'semen')?.quantity).toBe(40000)
    expect(incrementalStock.find(s => s.itemId === 'pasir')?.quantity).toBe(2000)
  })

  it('produces the same batchesProj sisa as rebuildProjections after a sale StockAdjusted against the batch', async () => {
    await appendEvents([createEvent('StockReceived', received('b1', 'semen', 40000), at('2026-09-18T07:00:00.000Z'))])
    await appendEvents([createEvent('StockAdjusted', { itemId: 'semen', quantity: -3000, reason: 'sale' as const, batchId: 'b1' }, at('2026-09-18T08:00:00.000Z'))])
    const incremental = await db.batchesProj.get('b1')

    await db.batchesProj.clear()
    await rebuildProjections()
    const rebuilt = await db.batchesProj.get('b1')

    expect(incremental).toEqual(rebuilt)
    expect(incremental?.sisa).toBe(37000)
  })

  it('drops a StockAdjusted referencing a batch this device has never received, both incrementally and on rebuild', async () => {
    await appendEvents([createEvent('StockAdjusted', { itemId: 'semen', quantity: -1000, reason: 'sale' as const, batchId: 'unknown-batch' }, at('2026-09-18T08:00:00.000Z'))])

    expect(await db.batchesProj.toArray()).toEqual([])
    await rebuildProjections()
    expect(await db.batchesProj.toArray()).toEqual([])
  })

  it('produces the same batchesProj row as rebuildProjections after a BatchCorrected', async () => {
    await appendEvents([createEvent('StockReceived', received('b1', 'semen', 40000), at('2026-09-18T07:00:00.000Z'))])
    await appendEvents([createEvent('BatchCorrected', {
      batchId: 'b1', supplierId: 'sup-2', hargaBeli: 58000, hargaJual: 65000, tanggalBeli: '2026-09-15T00:00:00.000Z',
    }, at('2026-09-18T09:00:00.000Z'))])
    const incremental = await db.batchesProj.get('b1')

    await db.batchesProj.clear()
    await rebuildProjections()
    const rebuilt = await db.batchesProj.get('b1')

    expect(incremental).toEqual(rebuilt)
    expect(incremental).toMatchObject({ supplierId: 'sup-2', hargaBeli: 58000, hargaJual: 65000 })
  })

  it('rebuild and incremental agree on batchesProj sisa even when a synced sale has an earlier recordedAt than its batch (clock skew across devices)', async () => {
    const receivedEvent = { ...createEvent('StockReceived', received('b1', 'semen', 40000), at('2026-09-18T10:00:00.000Z')), serverSeq: 1 }
    // A device running a few minutes behind pulls receivedEvent, then
    // authors and pushes a sale against it - its own recordedAt is earlier
    // than the batch's, but it can only exist causally after, so its
    // serverSeq is greater. This is the scenario the prior plan's final
    // review flagged; eventOrder.ts's compareCausal (Task 1) is what makes
    // it safe here.
    const saleEvent = { ...createEvent('StockAdjusted', { itemId: 'semen', quantity: -3000, reason: 'sale' as const, batchId: 'b1' }, at('2026-09-18T09:59:00.000Z')), serverSeq: 2 }

    await applyRemoteEvents([receivedEvent, saleEvent])
    await rebuildProjections()

    expect((await db.batchesProj.get('b1'))?.sisa).toBe(37000)
  })
})

describe('appendEvents incremental fold: sale itemIds/batchIds', () => {
  it('produces the same salesProj row as rebuildProjections, with itemIds/batchIds populated', async () => {
    const e = createEvent('SaleRecorded', {
      lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000, batchId: 'b1' }],
      metodeBayar: 'tunai' as const, subtotal: 63000, diskon: 0, total: 63000,
    }, at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    const incremental = await db.salesProj.get(e.id)

    await db.salesProj.clear()
    await rebuildProjections()
    const rebuilt = await db.salesProj.get(e.id)

    expect(incremental).toEqual(rebuilt)
    expect(incremental?.itemIds).toEqual(['semen'])
    expect(incremental?.batchIds).toEqual(['b1'])
  })
})

describe('appendEvents incremental fold: KategoriUpserted', () => {
  it('folds into kategoriProj and rebuildProjections restores the same row', async () => {
    const e = createEvent('KategoriUpserted', { id: 'kat_semen', nama: 'Semen', diarsipkan: false }, at('2026-09-30T07:00:00.000Z'))
    await appendEvents([e])
    const incremental = await db.kategoriProj.get('kat_semen')
    expect(incremental).toMatchObject({ id: 'kat_semen', nama: 'Semen', diarsipkan: false })

    await db.kategoriProj.clear()
    await rebuildProjections()

    expect(await db.kategoriProj.get('kat_semen')).toEqual(incremental)
  })
})

describe('appendEvents incremental fold: customers and payments', () => {
  it('folds CustomerUpserted into customersProj and PaymentReceived into paymentsProj', async () => {
    const customer = createEvent('CustomerUpserted', { id: 'c1', nama: 'Budi', telepon: '0812' }, at('2026-10-01T07:00:00.000Z'))
    const payment = createEvent('PaymentReceived', { saleId: 's1', jumlah: 25000 }, at('2026-10-02T07:00:00.000Z'))
    await appendEvents([customer, payment])

    expect(await db.customersProj.get('c1')).toMatchObject({ nama: 'Budi', telepon: '0812' })
    expect(await db.paymentsProj.get(payment.id)).toMatchObject({ saleId: 's1', jumlah: 25000 })
  })

  it('a later CustomerUpserted overwrites the row (last write wins)', async () => {
    await appendEvents([createEvent('CustomerUpserted', { id: 'c1', nama: 'Budi' }, at('2026-10-01T07:00:00.000Z'))])
    await appendEvents([createEvent('CustomerUpserted', { id: 'c1', nama: 'Budi Santoso' }, at('2026-10-01T08:00:00.000Z'))])
    expect((await db.customersProj.get('c1'))?.nama).toBe('Budi Santoso')
  })

  it('folds a Bon sale with its Bon fields', async () => {
    const bon = createEvent('SaleRecorded', {
      ...sale('semen', 100000), metodeBayar: 'bon' as const, customerId: 'c1', jatuhTempo: '2026-10-20', dibayarAwal: 30000,
    }, at('2026-10-03T07:00:00.000Z'))
    await appendEvents([bon])
    expect(await db.salesProj.get(bon.id)).toMatchObject({ metodeBayar: 'bon', customerId: 'c1', jatuhTempo: '2026-10-20', dibayarAwal: 30000 })
  })

  it('rebuildProjections reproduces both tables identically after the cache is discarded', async () => {
    await appendEvents([
      createEvent('CustomerUpserted', { id: 'c1', nama: 'Budi' }, at('2026-10-01T07:00:00.000Z')),
      createEvent('PaymentReceived', { saleId: 's1', jumlah: 25000 }, at('2026-10-02T07:00:00.000Z')),
    ])
    const customersBefore = await db.customersProj.toArray()
    const paymentsBefore = await db.paymentsProj.toArray()

    await db.customersProj.clear()
    await db.paymentsProj.clear()
    await rebuildProjections()

    expect(await db.customersProj.toArray()).toEqual(customersBefore)
    expect(await db.paymentsProj.toArray()).toEqual(paymentsBefore)
  })
})

describe('appendEvents incremental fold: TokoDiatur', () => {
  it('folds the shop name into the single tokoProj row', async () => {
    await appendEvents([createEvent('TokoDiatur', { nama: 'Toko Maju' }, at('2026-10-05T07:00:00.000Z'))])
    expect(await db.tokoProj.get('toko')).toMatchObject({ id: 'toko', nama: 'Toko Maju' })
    expect(await db.tokoProj.count()).toBe(1)
  })

  it('a later name overwrites it, and an empty one clears it', async () => {
    await appendEvents([createEvent('TokoDiatur', { nama: 'Toko Lama' }, at('2026-10-05T07:00:00.000Z'))])
    await appendEvents([createEvent('TokoDiatur', { nama: 'Toko Baru' }, at('2026-10-05T08:00:00.000Z'))])
    expect((await db.tokoProj.get('toko'))?.nama).toBe('Toko Baru')
    await appendEvents([createEvent('TokoDiatur', { nama: '' }, at('2026-10-05T09:00:00.000Z'))])
    expect((await db.tokoProj.get('toko'))?.nama).toBe('')
  })

  it('rebuildProjections reproduces the row identically after the cache is discarded', async () => {
    await appendEvents([
      createEvent('TokoDiatur', { nama: 'Toko Lama' }, at('2026-10-05T07:00:00.000Z')),
      createEvent('TokoDiatur', { nama: 'Toko Baru' }, at('2026-10-05T08:00:00.000Z')),
    ])
    const before = await db.tokoProj.toArray()
    await db.tokoProj.clear()
    await rebuildProjections()
    expect(await db.tokoProj.toArray()).toEqual(before)
  })
})

describe('appendEvents incremental fold: expenses', () => {
  it('folds ExpenseRecorded into expensesProj and ExpenseVoided marks it batal', async () => {
    const expense = createEvent('ExpenseRecorded', { jumlah: 750_000, kategori: 'listrik' }, at('2026-10-05T07:00:00.000Z'))
    await appendEvents([expense])
    expect(await db.expensesProj.get(expense.id)).toMatchObject({ jumlah: 750_000, kategori: 'listrik', status: 'aktif' })

    await appendEvents([createEvent('ExpenseVoided', { expenseId: expense.id }, at('2026-10-05T08:00:00.000Z'))])
    expect(await db.expensesProj.get(expense.id)).toMatchObject({ status: 'batal' })
  })

  it('rebuildProjections reproduces the table identically after the cache is discarded', async () => {
    const expense = createEvent('ExpenseRecorded', { jumlah: 750_000, kategori: 'listrik' }, at('2026-10-05T07:00:00.000Z'))
    await appendEvents([expense, createEvent('ExpenseVoided', { expenseId: expense.id }, at('2026-10-05T08:00:00.000Z'))])
    const before = await db.expensesProj.toArray()
    await db.expensesProj.clear()
    await rebuildProjections()
    expect(await db.expensesProj.toArray()).toEqual(before)
  })
})

describe('rebuildProjections: a void written in the same millisecond as its record', () => {
  it('still cancels the expense, whatever the random ids happen to be', async () => {
    for (let i = 0; i < 15; i += 1) {
      await db.delete(); await db.open()
      const record = createEvent('ExpenseRecorded', { jumlah: 5000, kategori: 'lainnya' }, at('2026-10-05T07:00:00.000Z'))
      const voided = createEvent('ExpenseVoided', { expenseId: record.id }, at('2026-10-05T07:00:00.000Z'))
      await appendEvents([record, voided])
      await rebuildProjections()
      expect((await db.expensesProj.get(record.id))?.status).toBe('batal')
    }
  })
})
