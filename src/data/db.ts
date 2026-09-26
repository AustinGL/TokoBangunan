import Dexie, { type Table } from 'dexie'
import type { EventEnvelope } from '../domain/events'
import type { Item } from '../domain/projections/items'
import type { StockLevel } from '../domain/projections/stock'
import type { Sale } from '../domain/projections/sales'
import type { Barang } from '../domain/projections/barang'
import type { Supplier } from '../domain/projections/suppliers'
import type { Batch } from '../domain/projections/batches'
import { projectBarang } from '../domain/projections/barang'
import { projectSuppliers } from '../domain/projections/suppliers'
import { projectBatches } from '../domain/projections/batches'
import { compareCausal } from './eventOrder'

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

/**
 * The set of locally-authored events not yet acknowledged by the server.
 * Mirrors appendEvents's writes: every event appended locally gets a row
 * here, and markSynced removes it once the server assigns a serverSeq.
 * Kept as its own table (rather than a serverSeq === null query) so an
 * upgrading device with a real unsynced backlog does not need every such
 * row independently touched for it to show up in getUnsyncedEvents.
 */
export type OutboxRow = { id: string }

class TokoDb extends Dexie {
  events!: Table<EventEnvelope, string>
  meta!: Table<MetaRow, string>
  itemsProj!: Table<Item, string>
  quarantine!: Table<QuarantineRow, string>
  stokProj!: Table<StockLevel, string>
  salesProj!: Table<Sale, string>
  outbox!: Table<OutboxRow, string>
  barangProj!: Table<Barang, string>
  suppliersProj!: Table<Supplier, string>
  batchesProj!: Table<Batch, string>

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
    // Additive only, same as v1 -> v2. The upgrade callback is new here
    // (v1 -> v2 had none): outbox is a derived index over serverSeq === null,
    // and a device upgrading with a real unsynced backlog must not have that
    // backlog vanish from getUnsyncedEvents until each row happens to be
    // independently touched.
    this.version(3).stores({
      stokProj: 'itemId',
      salesProj: 'id, occurredAt',
      outbox: 'id',
    }).upgrade(async tx => {
      const unsynced = await tx.table('events').filter((e: EventEnvelope) => e.serverSeq === null).toArray()
      if (unsynced.length > 0) {
        await tx.table('outbox').bulkPut(unsynced.map((e: EventEnvelope) => ({ id: e.id })))
      }
    })
    // barangProj, suppliersProj and batchesProj are new tables folded from
    // event types that predate this version (SupplierUpserted) or are brand
    // new (BarangUpserted, StockReceived, BatchCorrected). Either way the
    // safest backfill is the same full rebuild rebuildProjections() performs
    // routinely, run once here inside the upgrade transaction. The sync
    // cursor reset alongside it is a separate fix: a device that already
    // pulled a new-shaped event while still on the old schema stored it with
    // that event's new field zod-stripped (z.object silently drops unknown
    // keys), and nothing else re-fetches or re-parses it. Resetting the
    // cursor makes the next sync re-pull the whole log; applyRemoteEvents's
    // bulkPut then overwrites each such row by id with a copy this schema
    // parses in full.
    this.version(4).stores({
      barangProj: 'id, nama',
      suppliersProj: 'id, nama',
      batchesProj: 'batchId, itemId, supplierId, tanggalBeli',
    }).upgrade(async tx => {
      const events = (await tx.table('events').toArray()) as EventEnvelope[]
      const sorted = [...events].sort(compareCausal)
      await tx.table('barangProj').bulkPut(Object.values(projectBarang(sorted)))
      await tx.table('suppliersProj').bulkPut(Object.values(projectSuppliers(sorted)))
      await tx.table('batchesProj').bulkPut(Object.values(projectBatches(sorted)))
      await tx.table('meta').put({ key: 'syncCursor', value: 0 })
    })
  }
}

export const db = new TokoDb()
