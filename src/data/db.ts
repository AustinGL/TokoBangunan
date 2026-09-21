import Dexie, { type Table } from 'dexie'
import type { EventEnvelope } from '../domain/events'
import type { Item } from '../domain/projections/items'

export type MetaRow = { key: string; value: unknown }

/**
 * A record that arrived from sync but could not be fully validated by this
 * version of the app. Kept verbatim rather than dropped: the log is
 * append-only, and the usual reason a record lands here is an event type a
 * later release introduced. It is deliberately NOT in the events table, which
 * carries the invariant that every row is a fully parsed envelope with
 * canonical Z-form timestamps (see eventStore.applyRemoteEvents).
 */
export type QuarantineRow = {
  key: string
  raw: unknown
  reason: string
  quarantinedAt: string
}

class TokoDb extends Dexie {
  events!: Table<EventEnvelope, string>
  meta!: Table<MetaRow, string>
  itemsProj!: Table<Item, string>
  quarantine!: Table<QuarantineRow, string>

  constructor() {
    super('toko-bahan-bangunan')
    this.version(1).stores({
      events: 'id, serverSeq, type, occurredAt, recordedAt',
      meta: 'key',
      itemsProj: 'id, nama, kategori',
    })
    // Additive only: no existing store or index changes, so the upgrade is a
    // no-op for data already on disk.
    this.version(2).stores({
      quarantine: 'key, quarantinedAt',
    })
  }
}

export const db = new TokoDb()
