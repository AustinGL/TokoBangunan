import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'
import { parseEvent } from '../domain/events'

/**
 * The runSync tests in sync.test.ts exercise the sync contract through the
 * injectable SyncTransport, using fakes that re-implement the arithmetic
 * themselves. That proves runSync behaves correctly given a well-behaved
 * transport, but it never touches the real supabaseTransport, so it could not
 * catch a regression in the actual query expressions, in the owner_id claim
 * the RLS policy checks, or in the timestamp normalisation that every pulled
 * event depends on. This file pins those directly by mocking the supabase
 * client's query builder.
 */
type Result = { data: unknown[] | null; error: unknown }

type Builder = {
  select: (...args: unknown[]) => Builder
  eq: (...args: unknown[]) => Builder
  gt: (...args: unknown[]) => Builder
  order: (...args: unknown[]) => Builder
  limit: (...args: unknown[]) => Builder
  upsert: (...args: unknown[]) => Builder
  then: (resolve: (value: Result) => unknown) => Promise<unknown>
}

const { state, spies, fromSpy, getUserSpy } = vi.hoisted(() => {
  const state = {
    result: { data: [], error: null } as Result,
    user: { id: 'owner-1' } as { id: string } | null,
    // What getUser() reports next to a null user: a missing session, a rejected one, or a network failure.
    authError: null as unknown,
  }
  const spies = {
    select: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    upsert: vi.fn(),
  }
  const builder: Builder = {
    select: (...args: unknown[]) => { spies.select(...args); return builder },
    eq: (...args: unknown[]) => { spies.eq(...args); return builder },
    gt: (...args: unknown[]) => { spies.gt(...args); return builder },
    order: (...args: unknown[]) => { spies.order(...args); return builder },
    limit: (...args: unknown[]) => { spies.limit(...args); return builder },
    upsert: (...args: unknown[]) => { spies.upsert(...args); return builder },
    then: (resolve: (value: Result) => unknown) => Promise.resolve(state.result).then(resolve),
  }
  const fromSpy = vi.fn(() => builder)
  const getUserSpy = vi.fn(async () => ({ data: { user: state.user }, error: state.authError }))
  return { state, spies, fromSpy, getUserSpy }
})

vi.mock('./supabase', () => ({
  supabase: { from: fromSpy, auth: { getUser: getUserSpy } },
}))

const { supabaseTransport, CURSOR_OVERLAP, PAGE_SIZE, BelumMasukError } = await import('./sync')

const itemPayload = {
  id: 'semen-tiga-roda',
  nama: 'Semen Tiga Roda',
  baseUnit: 'sak',
  units: [{ unit: 'sak', factor: 1 }],
  hargaEceran: 52000,
  stokMinimum: 20,
}

/** Shaped exactly like a row PostgREST returns: snake_case, offset timestamps. */
const remoteRow = {
  id: 'evt-remote-1',
  type: 'ItemUpserted',
  payload: itemPayload,
  occurred_at: '2026-09-18T09:00:00+00:00',
  recorded_at: '2026-09-18T09:00:00.123456+00:00',
  device_id: 'laptop-kasir',
  server_seq: 12,
  owner_id: 'owner-1',
}

const localEvent = {
  id: 'evt-local-1',
  type: 'ItemUpserted' as const,
  payload: itemPayload,
  occurredAt: '2026-09-18T09:05:00.000Z',
  recordedAt: '2026-09-18T09:05:00.000Z',
  deviceId: 'phone-kasir',
  serverSeq: null,
}

beforeEach(() => {
  for (const spy of Object.values(spies)) spy.mockClear()
  fromSpy.mockClear()
  getUserSpy.mockClear()
  state.result = { data: [], error: null }
  state.user = { id: 'owner-1' }
})

describe('supabaseTransport.pull query', () => {
  it('queries an overlap window below the cursor rather than strictly greater than it', async () => {
    await supabaseTransport.pull(150)
    expect(spies.gt).toHaveBeenCalledWith('server_seq', 150 - CURSOR_OVERLAP)
  })

  it('clamps the overlap window at zero instead of querying a negative bound', async () => {
    await supabaseTransport.pull(10)
    expect(spies.gt).toHaveBeenCalledWith('server_seq', 0)
  })

  it('scopes the read to the signed-in owner as well as relying on RLS', async () => {
    await supabaseTransport.pull(0)
    expect(spies.eq).toHaveBeenCalledWith('owner_id', 'owner-1')
  })

  it('asks for exactly one page', async () => {
    await supabaseTransport.pull(0)
    expect(spies.limit).toHaveBeenCalledWith(PAGE_SIZE)
  })

  it('refuses to pull before sign-in, without touching the network', async () => {
    state.user = null
    await expect(supabaseTransport.pull(0)).rejects.toThrow('Tidak bisa sinkron: belum masuk.')
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe('supabaseTransport.pull timestamp normalisation', () => {
  it('converts the +00:00 offsets Postgres emits into canonical Z form', async () => {
    // Without this, zod's .datetime() (which accepts only a Z suffix) rejects
    // every pulled event, applyRemoteEvents quarantines the whole page, and
    // sync is silently push-only forever.
    state.result = { data: [remoteRow], error: null }

    const [event] = await supabaseTransport.pull(0)

    expect(event.occurredAt).toBe('2026-09-18T09:00:00.000Z')
    expect(event.recordedAt).toBe('2026-09-18T09:00:00.123Z')
  })

  it('produces a row that survives parseEvent, which the raw row would not', async () => {
    state.result = { data: [remoteRow], error: null }

    const [event] = await supabaseTransport.pull(0)

    expect(() => parseEvent(event)).not.toThrow()
    expect(parseEvent(event).serverSeq).toBe(12)
    // The guard that makes the assertion above meaningful: the untouched
    // offset form really is rejected, so normalisation is load-bearing.
    expect(() => parseEvent({ ...event, occurredAt: remoteRow.occurred_at })).toThrow()
  })

  it('maps the remaining snake_case columns onto the envelope', async () => {
    state.result = { data: [remoteRow], error: null }

    const [event] = await supabaseTransport.pull(0)

    expect(event).toMatchObject({
      id: 'evt-remote-1',
      type: 'ItemUpserted',
      deviceId: 'laptop-kasir',
      serverSeq: 12,
    })
  })

  it('names the field and the offending value instead of storing "Invalid Date"', async () => {
    state.result = { data: [{ ...remoteRow, recorded_at: 'not-a-timestamp' }], error: null }

    await expect(supabaseTransport.pull(0)).rejects.toThrow(/recorded_at.*not-a-timestamp/)
  })
})

describe('supabaseTransport.push', () => {
  it('attaches owner_id from the signed-in user, which the RLS policy checks', async () => {
    state.result = { data: [{ id: localEvent.id, server_seq: 31 }], error: null }

    await supabaseTransport.push([localEvent])

    const [rows] = spies.upsert.mock.calls[0] as [Array<Record<string, unknown>>]
    expect(rows[0]).toMatchObject({
      id: 'evt-local-1',
      type: 'ItemUpserted',
      occurred_at: localEvent.occurredAt,
      recorded_at: localEvent.recordedAt,
      device_id: 'phone-kasir',
      owner_id: 'owner-1',
    })
  })

  it('refuses to push before sign-in, without touching the network', async () => {
    state.user = null

    await expect(supabaseTransport.push([localEvent])).rejects.toThrow('Tidak bisa sinkron: belum masuk.')
    expect(fromSpy).not.toHaveBeenCalled()
    expect(spies.upsert).not.toHaveBeenCalled()
  })

  it('upserts on the event id and ignores duplicates, which the lost-ack self-heal depends on', async () => {
    // A push whose ack was lost is retried; ON CONFLICT DO NOTHING makes that
    // retry a no-op instead of an error. Postgres returns no row for the
    // skipped insert, which is exactly why runSync always pulls after pushing.
    state.result = { data: [], error: null }

    await supabaseTransport.push([localEvent])

    const [, options] = spies.upsert.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(options).toEqual({ onConflict: 'id', ignoreDuplicates: true })
  })

  it('maps server_seq back onto serverSeq for the acknowledged rows', async () => {
    state.result = { data: [{ id: 'evt-local-1', server_seq: 31 }], error: null }

    const assignments = await supabaseTransport.push([localEvent])

    expect(assignments).toEqual([{ id: 'evt-local-1', serverSeq: 31 }])
  })

  it('returns an empty assignment list when the server acknowledges nothing', async () => {
    state.result = { data: null, error: null }

    expect(await supabaseTransport.push([localEvent])).toEqual([])
  })

  it('throws the error the server reported', async () => {
    state.result = { data: null, error: new Error('rls denied') }

    await expect(supabaseTransport.push([localEvent])).rejects.toThrow('rls denied')
  })
})

describe('supabaseTransport: telling "not signed in" from "offline"', () => {
  beforeEach(() => {
    state.user = null
    state.authError = null
  })

  it('says "belum masuk" when there is no session at all', async () => {
    state.authError = new AuthSessionMissingError()

    await expect(supabaseTransport.pull(0)).rejects.toBeInstanceOf(BelumMasukError)
    await expect(supabaseTransport.push([])).rejects.toBeInstanceOf(BelumMasukError)
  })

  it('says "belum masuk" when the stored session is rejected (expired or revoked)', async () => {
    state.authError = new AuthApiError('invalid JWT', 401, 'bad_jwt')

    await expect(supabaseTransport.pull(0)).rejects.toBeInstanceOf(BelumMasukError)
  })

  it('does not say "belum masuk" when the check itself failed for lack of network: a signed-in owner who is offline has an ordinary failed sync', async () => {
    const offline = new AuthRetryableFetchError('Failed to fetch', 0)
    state.authError = offline

    await expect(supabaseTransport.pull(0)).rejects.toBe(offline)
    await expect(supabaseTransport.push([])).rejects.toBe(offline)
    await expect(supabaseTransport.pull(0)).rejects.not.toBeInstanceOf(BelumMasukError)
  })
})
