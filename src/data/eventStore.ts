import { db } from './db'
import { parseEvent, type EventEnvelope } from '../domain/events'
import { projectItems } from '../domain/projections/items'

const CURSOR_KEY = 'syncCursor'

export const appendEvent = async (event: EventEnvelope): Promise<void> => {
  await db.events.add(event)
}

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

/** Validates before writing: sync input is untrusted input. */
export const applyRemoteEvents = async (raw: unknown[]): Promise<void> => {
  const events = raw.map(parseEvent)
  await db.events.bulkPut(events)
}

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
