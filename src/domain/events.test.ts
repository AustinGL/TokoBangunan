import { describe, it, expect } from 'vitest'
import { createEvent, parseEvent } from './events'
import { fixedClock } from './clock'

const clock = fixedClock('2026-09-18T07:30:00.000Z')
const opts = { clock, deviceId: 'laptop-kasir' }

const itemPayload = {
  id: 'item-semen-tiga-roda',
  nama: 'Semen Tiga Roda',
  baseUnit: 'sak',
  units: [{ unit: 'sak', factor: 1 }, { unit: 'ton', factor: 20 }],
  hargaEceran: 52000,
  stokMinimum: 20000,
}

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...obj }
  delete copy[key]
  return copy
}

describe('createEvent', () => {
  it('stamps recordedAt from the clock', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(e.recordedAt).toBe('2026-09-18T07:30:00.000Z')
  })

  it('defaults occurredAt to recordedAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(e.occurredAt).toBe(e.recordedAt)
  })

  it('allows occurredAt to be backdated while recordedAt stays honest', () => {
    const e = createEvent('ItemUpserted', itemPayload, {
      ...opts,
      occurredAt: new Date('2026-09-16T10:00:00.000Z'),
    })
    expect(e.occurredAt).toBe('2026-09-16T10:00:00.000Z')
    expect(e.recordedAt).toBe('2026-09-18T07:30:00.000Z')
  })

  it('starts unsynced', () => {
    expect(createEvent('ItemUpserted', itemPayload, opts).serverSeq).toBeNull()
  })

  it('rejects a payload that fails its schema', () => {
    expect(() =>
      createEvent('ItemUpserted', { ...itemPayload, hargaEceran: 52000.5 }, opts),
    ).toThrow()
  })
})

describe('parseEvent', () => {
  it('accepts an event that came back from sync', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(parseEvent({ ...e, serverSeq: 42 }).serverSeq).toBe(42)
  })

  it('rejects an unknown event type', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, type: 'NotAThing' })).toThrow()
  })
})

describe('parseEvent envelope validation', () => {
  it('rejects a missing id', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent(omit(e, 'id'))).toThrow()
  })

  it('rejects an empty-string id', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, id: '' })).toThrow()
  })

  it('rejects a missing deviceId', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent(omit(e, 'deviceId'))).toThrow()
  })

  it('rejects an empty-string deviceId', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, deviceId: '' })).toThrow()
  })

  it('rejects a serverSeq that is not a number', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, serverSeq: '42' })).toThrow()
  })

  it('rejects a serverSeq that is not an integer', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, serverSeq: 1.5 })).toThrow()
  })

  it('rejects a missing occurredAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent(omit(e, 'occurredAt'))).toThrow()
  })

  it('rejects a missing recordedAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent(omit(e, 'recordedAt'))).toThrow()
  })
})
