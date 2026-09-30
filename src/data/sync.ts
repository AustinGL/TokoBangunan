import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { EventEnvelope } from '../domain/events'
import {
  getUnsyncedEvents, markSynced, applyRemoteEvents,
  getCursor, setCursor, rebuildProjections, promoteQuarantined,
} from './eventStore'

/** 'lokal' means no server is configured at all (local-only by design), which is not the same as a sync that failed. */
export type SyncStatus = 'tersinkron' | 'menyimpan' | 'belum-tersinkron' | 'lokal' | 'belum-masuk'

export type SyncTransport = {
  push(events: EventEnvelope[]): Promise<Array<{ id: string; serverSeq: number }>>
  pull(sinceSeq: number): Promise<EventEnvelope[]>
}

export const PAGE_SIZE = 500

/**
 * Hard ceiling on pull iterations within one runSync.
 *
 * The loop's real exit conditions are "a short page arrived" and "the cursor
 * did not move", both of which terminate normally. This cap exists only so a
 * misbehaving server that keeps returning full pages with an ever-advancing
 * cursor cannot spin forever inside a single sync. At PAGE_SIZE 500 it still
 * allows 50000 events to be caught up in one run, far past anything one shop
 * can accumulate while offline.
 */
export const MAX_PULL_PAGES = 100

/**
 * How far below the stored cursor a pull re-queries.
 *
 * Postgres allocates server_seq via nextval() the moment an INSERT
 * statement runs, but the row only becomes visible to other transactions
 * when it commits. Those two orders can diverge: if transaction A takes
 * server_seq 5 and commits after transaction B has already taken 6 and
 * committed, a puller that queried strictly greater-than its cursor and
 * already advanced past 6 will never re-query below it. A's event becomes
 * permanently invisible to that device, and the cursor never moves
 * backwards, so it cannot self-heal.
 *
 * This is reachable here: the system is explicitly multi-device (a phone
 * flushing a queued offline batch while the laptop records a sale is two
 * concurrent inserts).
 *
 * Mitigation: re-query an overlap window below the cursor instead of
 * strictly greater than it. This is safe because applyRemoteEvents is
 * idempotent (bulkPut keyed on event id), so re-reading an event costs
 * bandwidth and nothing else.
 */
export const CURSOR_OVERLAP = 100

/**
 * Push-new then pull-since-cursor. No conflict resolution: events are
 * immutable, so two writes cannot disagree. Both directions are idempotent.
 *
 * The pull runs in a loop until a page comes back short, which is what makes
 * the architecture doc's "device offline for days: cursor-based pull catches
 * up in pages, no special path" actually true. A single pull would cap a
 * catch-up at PAGE_SIZE rows per sync.
 */
export async function runSync(
  transport: SyncTransport,
): Promise<{ pushed: number; pulled: number }> {
  // Before anything network-dependent: a record quarantined by an earlier
  // release may be readable now that the app has been updated, and it must
  // reach the projection even if this sync goes on to fail offline.
  if (await promoteQuarantined() > 0) await rebuildProjections()

  const unsynced = await getUnsyncedEvents()
  let pushed = 0
  if (unsynced.length > 0) {
    const assignments = await transport.push(unsynced)
    await markSynced(assignments)
    pushed = assignments.length
  }

  let cursor = await getCursor()
  let pulled = 0

  for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
    const remote = await transport.pull(cursor)
    if (remote.length === 0) break

    await applyRemoteEvents(remote)
    pulled += remote.length

    const highest = remote.reduce((max, e) => Math.max(max, e.serverSeq ?? 0), cursor)
    // Cursor advances only after the local write commits, so an interrupted
    // pull simply refetches the page.
    if (highest > cursor) {
      await setCursor(highest)
      cursor = highest
    } else {
      // The overlap window means a page can consist entirely of rows at or
      // below the cursor. Nothing new arrived, so asking again would return
      // the same page forever.
      break
    }

    if (remote.length < PAGE_SIZE) break
  }

  // Runs on every sync, not only when remote rows arrived: a push-only sync
  // still has local appends behind it, and the read model must reflect them.
  await rebuildProjections()

  return { pushed, pulled }
}

/**
 * Postgres serialises timestamptz to JSON with a numeric offset
 * (2026-09-18T09:00:00+00:00), which zod's .datetime() rejects: it accepts
 * only a Z suffix. Normalising here, rather than loosening the schema, keeps
 * two guarantees at once: every stored timestamp is canonical Z form, which
 * reduceItems relies on when it compares recordedAt as raw strings for
 * last-write-wins, and the schema stays strict about what it will accept.
 */
const canonicalTimestamp = (field: string, value: unknown): string => {
  const parsed = new Date(value as string)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Sync: unreadable ${field} from server: ${String(value)}`)
  }
  return parsed.toISOString()
}

/**
 * No signed-in owner, so the server (whose rules only accept an owner's own
 * rows) will refuse everything. Its own class, not just a message, so the UI
 * can say "not signed in, nothing is backed up" rather than the vaguer
 * "not synced", which is what an ordinary network failure looks like.
 */
export class BelumMasukError extends Error {
  constructor() {
    super('Tidak bisa sinkron: belum masuk.')
    this.name = 'BelumMasukError'
  }
}

const requireOwnerId = async (): Promise<string> => {
  const { data: userData, error } = await supabase.auth.getUser()
  const ownerId = userData.user?.id
  if (ownerId) return ownerId
  // getUser() always asks the server, and when the network is down it returns an
  // error rather than throwing. A signed-in owner who is merely offline must read
  // as an ordinary failed sync ("belum tersinkron"), never as "not signed in":
  // that would send them to re-enter a password that was never the problem.
  // A missing or rejected (expired, revoked) session is a real "belum masuk".
  if (error && isAuthRetryableFetchError(error)) throw error
  throw new BelumMasukError()
}

export const supabaseTransport: SyncTransport = {
  async push(events) {
    const ownerId = await requireOwnerId()

    const rows = events.map(e => ({
      id: e.id,
      type: e.type,
      payload: e.payload,
      occurred_at: e.occurredAt,
      recorded_at: e.recordedAt,
      device_id: e.deviceId,
      owner_id: ownerId,
    }))

    const { data, error } = await supabase
      .from('events')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      .select('id, server_seq')
    if (error) throw error

    return (data ?? []).map(r => ({ id: r.id as string, serverSeq: r.server_seq as number }))
  },

  async pull(sinceSeq) {
    const ownerId = await requireOwnerId()

    const { data, error } = await supabase
      .from('events')
      .select('*')
      // Defence in depth. RLS already scopes this to the owner server-side;
      // the filter means a misconfigured policy cannot quietly widen the read.
      .eq('owner_id', ownerId)
      .gt('server_seq', Math.max(0, sinceSeq - CURSOR_OVERLAP))
      .order('server_seq', { ascending: true })
      .limit(PAGE_SIZE)
    if (error) throw error

    return (data ?? []).map(r => ({
      id: r.id as string,
      type: r.type as EventEnvelope['type'],
      payload: r.payload,
      occurredAt: canonicalTimestamp('occurred_at', r.occurred_at),
      recordedAt: canonicalTimestamp('recorded_at', r.recorded_at),
      deviceId: r.device_id as string,
      serverSeq: r.server_seq as number,
    }))
  },
}
