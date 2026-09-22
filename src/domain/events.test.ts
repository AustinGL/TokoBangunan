import { describe, it, expect } from 'vitest'
import { createEvent, parseEvent, classifyEvent } from './events'
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

  // The schema accepts only a Z suffix, and that strictness is deliberate:
  // reduceItems compares recordedAt as a raw string for last-write-wins, so a
  // log holding a mix of '...Z' and '...+00:00' would tie-break by ASCII at
  // the offset character. Postgres serialises timestamptz with a +00:00
  // offset, which is why the pull adapter normalises before this schema ever
  // sees it (data/sync.ts canonicalTimestamp), rather than the schema being
  // relaxed to let the offset form through.
  it('rejects an offset-form occurredAt, leaving normalisation to the adapter', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, occurredAt: '2026-09-18T09:00:00+00:00' })).toThrow()
  })

  it('rejects an offset-form recordedAt for the same reason', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    expect(() => parseEvent({ ...e, recordedAt: '2026-09-18T09:00:00.123456+00:00' })).toThrow()
  })
})

describe('classifyEvent', () => {
  it('reports a fully valid event as valid, with its payload parsed', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    const result = classifyEvent({ ...e, serverSeq: 3 })
    expect(result.status).toBe('valid')
    if (result.status === 'valid') expect(result.event.serverSeq).toBe(3)
  })

  // The forward-compatibility case: a device still on this release receiving
  // an event type a later release introduced. The envelope is sound, so the
  // record is usable later and must be distinguishable from corruption.
  it('separates an unknown event type from an invalid record', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    const result = classifyEvent({ ...e, type: 'NotYetKnownType' })
    expect(result.status).toBe('unknown-type')
    if (result.status === 'unknown-type') {
      expect(result.event.id).toBe(e.id)
      expect(result.reason).toContain('NotYetKnownType')
    }
  })

  it('reports a broken envelope as invalid, naming the offending field', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    const result = classifyEvent({ ...e, recordedAt: 'banana' })
    expect(result.status).toBe('invalid')
    if (result.status === 'invalid') expect(result.reason).toContain('recordedAt')
  })

  it('reports a known type with a bad payload as invalid, not as an unknown type', () => {
    const e = createEvent('ItemUpserted', itemPayload, opts)
    const result = classifyEvent({ ...e, payload: { ...itemPayload, hargaEceran: 'gratis' } })
    expect(result.status).toBe('invalid')
    if (result.status === 'invalid') expect(result.reason).toContain('ItemUpserted')
  })

  it('reports a non-object as invalid rather than throwing', () => {
    expect(classifyEvent(null).status).toBe('invalid')
    expect(classifyEvent('nope').status).toBe('invalid')
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
