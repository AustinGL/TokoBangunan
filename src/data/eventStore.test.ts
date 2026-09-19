import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import {
  appendEvent, getUnsyncedEvents, markSynced, getAllEvents,
  applyRemoteEvents, getCursor, setCursor, rebuildProjections,
} from './eventStore'
import { createEvent } from '../domain/events'
import { fixedClock } from '../domain/clock'

const item = (id: string, harga: number) => ({
  id, nama: `Item ${id}`, baseUnit: 'sak',
  units: [{ unit: 'sak', factor: 1 }], hargaEceran: harga, stokMinimum: 0,
})
const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('event store', () => {
  it('appends and reads back', async () => {
    const e = createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z'))
    await appendEvent(e)
    expect(await getAllEvents()).toHaveLength(1)
  })

  it('reports unsynced events', async () => {
    await appendEvent(createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z')))
    await appendEvent(createEvent('ItemUpserted', item('b', 200), at('2026-09-18T07:01:00.000Z')))
    expect(await getUnsyncedEvents()).toHaveLength(2)
  })

  it('stops reporting events once marked synced', async () => {
    const e = createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z'))
    await appendEvent(e)
    await markSynced([{ id: e.id, serverSeq: 1 }])
    expect(await getUnsyncedEvents()).toHaveLength(0)
  })

  it('is idempotent when the same remote event arrives twice', async () => {
    const e = { ...createEvent('ItemUpserted', item('a', 100), at('2026-09-18T07:00:00.000Z')), serverSeq: 7 }
    await applyRemoteEvents([e])
    await applyRemoteEvents([e])
    expect(await getAllEvents()).toHaveLength(1)
  })

  it('rejects a malformed remote event', async () => {
    await expect(
      applyRemoteEvents([{ id: 'x', type: 'NotAThing', payload: {}, occurredAt: 'a', recordedAt: 'b', deviceId: 'd', serverSeq: 1 } as never]),
    ).rejects.toThrow()
  })

  it('tracks the sync cursor, starting at zero', async () => {
    expect(await getCursor()).toBe(0)
    await setCursor(42)
    expect(await getCursor()).toBe(42)
  })
})

describe('rebuildProjections', () => {
  it('produces identical state after the cache is discarded', async () => {
    await appendEvent(createEvent('ItemUpserted', item('semen', 52000), at('2026-09-18T07:00:00.000Z')))
    await appendEvent(createEvent('ItemUpserted', item('pasir', 180000), at('2026-09-18T07:01:00.000Z')))
    await rebuildProjections()
    const first = await db.itemsProj.toArray()

    await db.itemsProj.clear()
    await rebuildProjections()
    const second = await db.itemsProj.toArray()

    expect(second).toEqual(first)
    expect(second).toHaveLength(2)
  })
})
