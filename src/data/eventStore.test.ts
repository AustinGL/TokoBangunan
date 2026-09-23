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
