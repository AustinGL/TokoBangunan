import Dexie, { type Table } from 'dexie'
import type { EventEnvelope } from '../domain/events'
import type { Item } from '../domain/projections/items'

export type MetaRow = { key: string; value: unknown }

class TokoDb extends Dexie {
  events!: Table<EventEnvelope, string>
  meta!: Table<MetaRow, string>
  itemsProj!: Table<Item, string>

  constructor() {
    super('toko-bahan-bangunan')
    this.version(1).stores({
      events: 'id, serverSeq, type, occurredAt, recordedAt',
      meta: 'key',
      itemsProj: 'id, nama, kategori',
    })
  }
}

export const db = new TokoDb()
