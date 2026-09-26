import { describe, it, expect } from 'vitest'
import { compareCausal } from './eventOrder'
import { createEvent, type EventEnvelope } from '../domain/events'
import { fixedClock } from '../domain/clock'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })
const item = (id: string) => ({
  id, nama: `Item ${id}`, baseUnit: 'sak', units: [{ unit: 'sak', factor: 1 }], hargaEceran: 1000, stokMinimum: 0,
})
const withSeq = (e: EventEnvelope, serverSeq: number | null): EventEnvelope => ({ ...e, serverSeq })

describe('compareCausal', () => {
  it('orders two synced events by serverSeq, even when recordedAt disagrees (clock skew)', () => {
    const earlyBySeq = withSeq(createEvent('ItemUpserted', item('a'), at('2026-09-18T07:00:00.000Z')), 1)
    const lateBySeqEarlyByClock = withSeq(createEvent('ItemUpserted', item('b'), at('2026-09-18T06:59:00.000Z')), 2)

    const sorted = [lateBySeqEarlyByClock, earlyBySeq].sort(compareCausal)

    expect(sorted.map(e => e.id)).toEqual([earlyBySeq.id, lateBySeqEarlyByClock.id])
  })

  it('sorts every unsynced (serverSeq null) event after every synced event', () => {
    const synced = withSeq(createEvent('ItemUpserted', item('a'), at('2026-09-18T07:00:00.000Z')), 5)
    const local = createEvent('ItemUpserted', item('b'), at('2026-09-18T06:00:00.000Z'))

    const sorted = [local, synced].sort(compareCausal)

    expect(sorted.map(e => e.id)).toEqual([synced.id, local.id])
  })

  it('falls back to recordedAt, then id, when both events are unsynced (the common single-device case)', () => {
    const first = createEvent('ItemUpserted', item('a'), at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('ItemUpserted', item('b'), at('2026-09-18T07:01:00.000Z'))

    expect([second, first].sort(compareCausal).map(e => e.id)).toEqual([first.id, second.id])
  })

  it('breaks a tie between two unsynced events with an identical recordedAt by id', () => {
    const first = createEvent('ItemUpserted', item('a'), at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('ItemUpserted', item('b'), at('2026-09-18T07:00:00.000Z'))
    expect(second.id > first.id).toBe(true)

    expect([second, first].sort(compareCausal).map(e => e.id)).toEqual([first.id, second.id])
  })
})
