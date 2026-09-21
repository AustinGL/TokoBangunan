import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from './db'
import { appendEvents, getUnsyncedEvents, getCursor } from './eventStore'
import { runSync, CURSOR_OVERLAP, PAGE_SIZE, type SyncTransport } from './sync'
import { createEvent, type EventEnvelope } from '../domain/events'
import { fixedClock } from '../domain/clock'

const item = (id: string) => ({
  id, nama: `Item ${id}`, baseUnit: 'sak',
  units: [{ unit: 'sak', factor: 1 }], hargaEceran: 1000, stokMinimum: 0,
})
const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const transport = (overrides: Partial<SyncTransport> = {}): SyncTransport => ({
  push: vi.fn(async (events: EventEnvelope[]) => events.map((e, i) => ({ id: e.id, serverSeq: i + 1 }))),
  pull: vi.fn(async () => []),
  ...overrides,
})

describe('runSync', () => {
  it('pushes unsynced events and marks them synced', async () => {
    await appendEvents([createEvent('ItemUpserted', item('a'), at('2026-09-18T07:00:00.000Z'))])
    const t = transport()

    const result = await runSync(t)

    expect(result.pushed).toBe(1)
    expect(await getUnsyncedEvents()).toHaveLength(0)
  })

  it('pulls remote events and advances the cursor', async () => {
    const remote = { ...createEvent('ItemUpserted', item('b'), at('2026-09-18T08:00:00.000Z')), serverSeq: 9 }
    const t = transport({ pull: vi.fn(async () => [remote]) })

    const result = await runSync(t)

    expect(result.pulled).toBe(1)
    expect(await getCursor()).toBe(9)
    expect(await db.itemsProj.get('b')).toBeDefined()
  })

  it('leaves unacknowledged events unsynced after a partial push', async () => {
    const a = createEvent('ItemUpserted', item('a'), at('2026-09-18T07:00:00.000Z'))
    const b = createEvent('ItemUpserted', item('b'), at('2026-09-18T07:01:00.000Z'))
    await appendEvents([a])
    await appendEvents([b])
    // Server acknowledges only the first.
    const t = transport({ push: vi.fn(async () => [{ id: a.id, serverSeq: 1 }]) })

    const result = await runSync(t)

    // Not just "did not throw": the acknowledged event must actually carry
    // its assigned serverSeq, and the unacknowledged one must remain in the
    // unsynced set by identity, not merely by count.
    expect(result.pushed).toBe(1)
    expect((await db.events.get(a.id))?.serverSeq).toBe(1)
    const stillUnsynced = await getUnsyncedEvents()
    expect(stillUnsynced.map(e => e.id)).toEqual([b.id])
  })

  it('does not advance the cursor when the pull throws', async () => {
    // A fresh cursor is 0 and cannot go lower, so asserting "still 0" here
    // would pass even if runSync wrote a cursor before the failing pull.
    // Prime a real, non-zero cursor first so a regression has somewhere to
    // go wrong.
    const primed = { ...createEvent('ItemUpserted', item('primer'), at('2026-09-18T07:30:00.000Z')), serverSeq: 3 }
    await runSync(transport({ pull: vi.fn(async () => [primed]) }))
    expect(await getCursor()).toBe(3)

    const t = transport({ pull: vi.fn(async () => { throw new Error('offline') }) })
    await expect(runSync(t)).rejects.toThrow('offline')
    expect(await getCursor()).toBe(3)
  })

  it('is safe to run twice with the same events', async () => {
    const remote = { ...createEvent('ItemUpserted', item('c'), at('2026-09-18T08:00:00.000Z')), serverSeq: 5 }
    const first = await runSync(transport({ pull: vi.fn(async () => [remote]) }))
    const second = await runSync(transport({ pull: vi.fn(async () => [remote]) }))

    // The primary key on event id would dedupe the row regardless of what
    // runSync does, so a bare row-count check alone would pass even for a
    // broken runSync. Pin the cursor and projection too, so a bug that
    // double-advances the cursor or corrupts the rebuilt projection on a
    // repeat sync is also caught.
    expect(first.pulled).toBe(1)
    expect(second.pulled).toBe(1)
    expect(await db.events.count()).toBe(1)
    expect(await getCursor()).toBe(5)
    expect(await db.itemsProj.get('c')).toMatchObject({ id: 'c', hargaEceran: 1000 })
  })

  it('refreshes the read model even when the pull brings back nothing', async () => {
    // runSync used to return early on an empty pull, so rebuildProjections
    // never ran. A successful push-only sync would leave the read model stale.
    const e = createEvent('ItemUpserted', item('lokal'), at('2026-09-18T07:00:00.000Z'))
    await appendEvents([e])
    // Discard the cache behind runSync's back, so only a rebuild can restore it.
    await db.itemsProj.clear()

    const result = await runSync(transport())

    expect(result.pulled).toBe(0)
    expect(await db.itemsProj.get('lokal')).toBeDefined()
  })

  it('keeps pulling until a page comes back short, so a long-offline device catches up', async () => {
    // The architecture doc claims "cursor-based pull catches up in pages, no
    // special path". A single pull per runSync caps catch-up at PAGE_SIZE rows
    // per app launch, which for a device offline for days is not catching up.
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({
      ...createEvent('ItemUpserted', item(`p1-${i}`), at('2026-09-18T07:00:00.000Z')),
      serverSeq: i + 1,
    }))
    const secondPage = [
      { ...createEvent('ItemUpserted', item('p2-a'), at('2026-09-18T08:00:00.000Z')), serverSeq: PAGE_SIZE + 1 },
      { ...createEvent('ItemUpserted', item('p2-b'), at('2026-09-18T08:01:00.000Z')), serverSeq: PAGE_SIZE + 2 },
    ]
    let call = 0
    const pull = vi.fn(async () => {
      call += 1
      if (call === 1) return firstPage
      if (call === 2) return secondPage
      return []
    })

    const result = await runSync(transport({ pull }))

    // Two calls, not three: the short second page ends the loop without a
    // wasted round trip.
    expect(pull).toHaveBeenCalledTimes(2)
    expect(result.pulled).toBe(PAGE_SIZE + 2)
    expect(await db.events.count()).toBe(PAGE_SIZE + 2)
    expect(await getCursor()).toBe(PAGE_SIZE + 2)
    expect(await db.itemsProj.get('p1-0')).toBeDefined()
    expect(await db.itemsProj.get('p2-b')).toBeDefined()
  })

  it('stops looping when a full page carries nothing new, instead of spinning forever', async () => {
    // The overlap window means a page can consist entirely of rows at or below
    // the cursor. Without a no-progress guard, a full page of those would be
    // requested again and again up to the iteration cap.
    const page = Array.from({ length: PAGE_SIZE }, (_, i) => ({
      ...createEvent('ItemUpserted', item(`same-${i}`), at('2026-09-18T07:00:00.000Z')),
      serverSeq: 0,
    }))
    const pull = vi.fn(async () => page)

    await runSync(transport({ pull }))

    expect(pull).toHaveBeenCalledTimes(1)
  })

  it('recovers an event whose server_seq commits below an already-advanced cursor', async () => {
    // This is the scenario CURSOR_OVERLAP exists for: server_seq 5 is
    // allocated before server_seq 6, but its transaction commits later, so
    // it is invisible to the first pull. By the time it commits, a naive
    // strictly-greater-than pull has already advanced its cursor to 6 and
    // would never see 5 again. The fake transport's pull below mirrors the
    // overlap-window query supabaseTransport.pull runs for real.
    const eventSix = { ...createEvent('ItemUpserted', item('f'), at('2026-09-18T08:00:00.000Z')), serverSeq: 6 }
    const eventFive = { ...createEvent('ItemUpserted', item('e'), at('2026-09-18T07:59:00.000Z')), serverSeq: 5 }
    let call = 0
    const pull = vi.fn(async (sinceSeq: number) => {
      call += 1
      // On the server, only eventSix has committed when the first pull
      // runs; eventFive commits afterwards and becomes visible only later.
      const committed = call === 1 ? [eventSix] : [eventSix, eventFive]
      return committed.filter(e => (e.serverSeq ?? 0) > Math.max(0, sinceSeq - CURSOR_OVERLAP))
    })
    const t = transport({ pull })

    await runSync(t)
    expect(await db.events.get(eventFive.id)).toBeUndefined()

    await runSync(t)
    expect(await db.events.get(eventFive.id)).toBeDefined()
  })
})
