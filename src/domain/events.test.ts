import { describe, it, expect } from 'vitest'
import { createEvent, parseEvent } from './events'
import { fixedClock } from './clock'
import type { Clock } from './clock'

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

const customerPayload = {
  id: 'cust-budi',
  nama: 'Budi',
}

function omit(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...obj }
  delete copy[key]
  return copy
}

/** A clock that advances by 1ms on every read, to expose double-read bugs that fixedClock would mask. */
const advancingClock = (startIso: string): Clock => {
  let t = new Date(startIso).getTime()
  return { now: () => new Date(t++) }
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

  it('produces an occurredAt exactly equal to recordedAt on the default path, even with a clock that advances on every read', () => {
    const e = createEvent('ItemUpserted', itemPayload, {
      clock: advancingClock('2026-09-18T07:30:00.000Z'),
      deviceId: 'laptop-kasir',
    })
    expect(e.occurredAt).toBe(e.recordedAt)
  })

  it('still honours an explicitly supplied occurredAt, distinct from recordedAt, with an advancing clock', () => {
    const e = createEvent('ItemUpserted', itemPayload, {
      clock: advancingClock('2026-09-18T07:30:00.000Z'),
      deviceId: 'laptop-kasir',
      occurredAt: new Date('2026-09-16T10:00:00.000Z'),
    })
    expect(e.occurredAt).toBe('2026-09-16T10:00:00.000Z')
    expect(e.recordedAt).not.toBe(e.occurredAt)
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

  it('rejects a malformed occurredAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, occurredAt: 'banana' })).toThrow()
  })

  it('rejects a malformed recordedAt', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, recordedAt: 'banana' })).toThrow()
  })
})

describe('parseEvent payload validation', () => {
  it('applies schema defaults to a payload arriving from sync, matching the local createEvent path', () => {
    const local = createEvent('CustomerUpserted', customerPayload, opts)
    const rawFromSync = {
      id: 'evt-from-sync',
      type: 'CustomerUpserted',
      payload: customerPayload,
      occurredAt: local.occurredAt,
      recordedAt: local.recordedAt,
      deviceId: 'phone-kasir',
      serverSeq: 7,
    }
    const synced = parseEvent(rawFromSync)
    expect(synced.payload).toEqual(local.payload)
  })

  it('strips an unknown extra key from a payload arriving from sync', () => {
    const rawFromSync = {
      id: 'evt-strip',
      type: 'SupplierUpserted',
      payload: { id: 'sup-1', nama: 'Toko Jaya', extra: 'should be stripped' },
      occurredAt: '2026-09-18T07:30:00.000Z',
      recordedAt: '2026-09-18T07:30:00.000Z',
      deviceId: 'laptop-kasir',
      serverSeq: 1,
    }
    const parsed = parseEvent(rawFromSync)
    expect(parsed.payload).not.toHaveProperty('extra')
  })
})
