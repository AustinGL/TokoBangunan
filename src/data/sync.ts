import { supabase } from './supabase'
import type { EventEnvelope } from '../domain/events'
import {
  getUnsyncedEvents, markSynced, applyRemoteEvents,
  getCursor, setCursor, rebuildProjections,
} from './eventStore'

export type SyncStatus = 'tersinkron' | 'menyimpan' | 'belum-tersinkron'

export type SyncTransport = {
  push(events: EventEnvelope[]): Promise<Array<{ id: string; serverSeq: number }>>
  pull(sinceSeq: number): Promise<EventEnvelope[]>
}

const PAGE_SIZE = 500

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
 */
export async function runSync(
  transport: SyncTransport,
): Promise<{ pushed: number; pulled: number }> {
  const unsynced = await getUnsyncedEvents()
  let pushed = 0
  if (unsynced.length > 0) {
    const assignments = await transport.push(unsynced)
    await markSynced(assignments)
    pushed = assignments.length
  }

  const cursor = await getCursor()
  const remote = await transport.pull(cursor)
  if (remote.length === 0) return { pushed, pulled: 0 }

  await applyRemoteEvents(remote)
  const highest = remote.reduce((max, e) => Math.max(max, e.serverSeq ?? 0), cursor)
  // Cursor advances only after the local write commits, so an interrupted
  // pull simply refetches the page.
  await setCursor(highest)
  await rebuildProjections()

  return { pushed, pulled: remote.length }
}

export const supabaseTransport: SyncTransport = {
  async push(events) {
    const { data: userData } = await supabase.auth.getUser()
    const ownerId = userData.user?.id
    if (!ownerId) throw new Error('Tidak bisa sinkron: belum masuk.')

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
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gt('server_seq', Math.max(0, sinceSeq - CURSOR_OVERLAP))
      .order('server_seq', { ascending: true })
      .limit(PAGE_SIZE)
    if (error) throw error

    return (data ?? []).map(r => ({
      id: r.id as string,
      type: r.type as EventEnvelope['type'],
      payload: r.payload,
      occurredAt: r.occurred_at as string,
      recordedAt: r.recorded_at as string,
      deviceId: r.device_id as string,
      serverSeq: r.server_seq as number,
    }))
  },
}
