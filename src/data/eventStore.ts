import { db, type QuarantineRow } from './db'
import { classifyEvent, type EventEnvelope } from '../domain/events'
import { newEventId } from '../domain/ids'
import { projectItems } from '../domain/projections/items'

const CURSOR_KEY = 'syncCursor'

export const appendEvent = async (event: EventEnvelope): Promise<void> => {
  await db.events.add(event)
  // The read model is a cache of the log, so it has to be refreshed on the
  // local write path too. Without this a locally recorded event stays
  // invisible to every reader until an unrelated remote event happens to
  // arrive. A full rebuild is deliberate: it is the only fold the
  // rebuild-equivalence test guards, so it cannot silently diverge from the
  // canonical projection the way a hand-written incremental update could.
  await rebuildProjections()
}

/**
 * Correctness for two events with an identical recordedAt comes from the
 * deterministic tie-break inside projectItems (by event id), not from this
 * query's ordering. Do not rely on Dexie's tie-break here for correctness.
 */
export const getAllEvents = (): Promise<EventEnvelope[]> =>
  db.events.orderBy('recordedAt').toArray()

export const getUnsyncedEvents = (): Promise<EventEnvelope[]> =>
  db.events.filter(e => e.serverSeq === null).toArray()

export const markSynced = async (
  assignments: Array<{ id: string; serverSeq: number }>,
): Promise<void> => {
  await db.transaction('rw', db.events, async () => {
    for (const { id, serverSeq } of assignments) {
      await db.events.update(id, { serverSeq })
    }
  })
}

export type ApplyResult = {
  /** Events written to the log. */
  applied: number
  /** Records this version could not parse, stored in the quarantine table. */
  quarantined: number
}

const quarantineKey = (raw: unknown): string => {
  const id = (raw as { id?: unknown } | null)?.id
  return typeof id === 'string' && id.length > 0 ? id : `unkeyed-${newEventId()}`
}

/**
 * Validates before writing: sync input is untrusted input.
 *
 * Partitions rather than throwing. The log is append-only and shared between
 * devices on different releases, so a single record this version cannot parse
 * is an expected condition, not a catastrophe: throwing here would leave the
 * cursor un-advanced and make every later sync refetch and rethrow on the same
 * page forever. Unparseable records are kept verbatim in the quarantine table
 * and retried by promoteQuarantined once the app knows how to read them.
 */
export const applyRemoteEvents = async (raw: unknown[]): Promise<ApplyResult> => {
  const valid: EventEnvelope[] = []
  const rejected: QuarantineRow[] = []
  const quarantinedAt = new Date().toISOString()

  for (const row of raw) {
    const result = classifyEvent(row)
    if (result.status === 'valid') {
      valid.push(result.event)
      continue
    }
    rejected.push({ key: quarantineKey(row), raw: row, reason: result.reason, quarantinedAt })
  }

  await db.transaction('rw', db.events, db.quarantine, async () => {
    if (valid.length > 0) await db.events.bulkPut(valid)
    if (rejected.length > 0) await db.quarantine.bulkPut(rejected)
  })

  if (rejected.length > 0) {
    // Observable rather than silent: a wedged device used to look identical to
    // a healthy one from the outside.
    console.warn(
      `Sync: ${rejected.length} event(s) quarantined, unreadable by this version.`,
      rejected.map(r => `${r.key}: ${r.reason}`),
    )
  }

  return { applied: valid.length, quarantined: rejected.length }
}

/**
 * Re-parses quarantined records against the current schemas and moves the ones
 * that now validate into the log. This is what makes quarantine a delay rather
 * than a loss: a Phase 1 phone stores a Phase 2 event it cannot read, and the
 * moment that phone updates, the event is promoted and projected with no
 * re-pull and no user action.
 */
export const promoteQuarantined = async (): Promise<number> => {
  const rows = await db.quarantine.toArray()
  if (rows.length === 0) return 0

  const promoted: EventEnvelope[] = []
  const keys: string[] = []
  for (const row of rows) {
    const result = classifyEvent(row.raw)
    if (result.status !== 'valid') continue
    promoted.push(result.event)
    keys.push(row.key)
  }
  if (promoted.length === 0) return 0

  await db.transaction('rw', db.events, db.quarantine, async () => {
    await db.events.bulkPut(promoted)
    await db.quarantine.bulkDelete(keys)
  })
  return promoted.length
}

export const getQuarantined = (): Promise<QuarantineRow[]> => db.quarantine.toArray()

export const getCursor = async (): Promise<number> => {
  const row = await db.meta.get(CURSOR_KEY)
  return (row?.value as number | undefined) ?? 0
}

export const setCursor = async (seq: number): Promise<void> => {
  await db.meta.put({ key: CURSOR_KEY, value: seq })
}

/**
 * Projections are a cache. Discarding and rebuilding must always produce
 * identical state, which the test suite asserts.
 */
export const rebuildProjections = async (): Promise<void> => {
  const events = await getAllEvents()
  const items = projectItems(events)
  await db.transaction('rw', db.itemsProj, async () => {
    await db.itemsProj.clear()
    await db.itemsProj.bulkPut(Object.values(items))
  })
}
