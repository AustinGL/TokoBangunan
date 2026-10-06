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

describe('compareCausal: a void never sorts before what it voids', () => {
  const T = '2026-09-18T07:00:00.000Z'

  it('puts a void after other unsynced events with an identical recordedAt, whatever the ids are', () => {
    // Ids are UUIDv7, monotonic on a device even within one millisecond, so the tie-break by id
    // already keeps a void after the record it was made for. This pins that guarantee: if ids ever
    // stop being time-ordered, a rebuild could apply a void before its target and silently drop it.
    for (let i = 0; i < 60; i += 1) {
      const record = createEvent('ExpenseRecorded', { jumlah: 1000, kategori: 'sewa' }, at(T))
      const voided = createEvent('ExpenseVoided', { expenseId: record.id }, at(T))
      expect([voided, record].sort(compareCausal).map(e => e.type)).toEqual(['ExpenseRecorded', 'ExpenseVoided'])
      expect([record, voided].sort(compareCausal).map(e => e.type)).toEqual(['ExpenseRecorded', 'ExpenseVoided'])
    }
  })

  it('does the same for a cancelled sale', () => {
    for (let i = 0; i < 30; i += 1) {
      const sale = createEvent('SaleRecorded', {
        lines: [{ itemId: 'x', nama: 'X', unit: 'sak', qty: 1000, hargaSatuan: 1000, subtotal: 1000 }],
        metodeBayar: 'tunai', subtotal: 1000, diskon: 0, total: 1000,
      }, at(T))
      const voided = createEvent('SaleVoided', { saleId: sale.id, alasan: 'salah' }, at(T))
      expect([voided, sale].sort(compareCausal).map(e => e.type)).toEqual(['SaleRecorded', 'SaleVoided'])
    }
  })

  it('still orders by recordedAt first: an earlier void is not dragged after a later event', () => {
    const early = createEvent('ExpenseVoided', { expenseId: 'x' }, at('2026-09-18T07:00:00.000Z'))
    const late = createEvent('ItemUpserted', item('a'), at('2026-09-18T07:00:01.000Z'))
    expect([late, early].sort(compareCausal).map(e => e.id)).toEqual([early.id, late.id])
  })
})
