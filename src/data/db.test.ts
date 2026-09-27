import 'fake-indexeddb/auto'
import Dexie, { type Table } from 'dexie'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from './db'
import { createEvent, type EventEnvelope } from '../domain/events'
import { fixedClock } from '../domain/clock'
import { getCursor } from './eventStore'

const DB_NAME = 'toko-bahan-bangunan'
const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

/**
 * Replicates exactly TokoDb's versions 1-3 (db.ts) under the real database
 * name, so opening it seeds a genuine v3 IndexedDB database. Opening the
 * real `db` (versions 1-4) afterward makes Dexie run its own
 * version(4).upgrade() callback for real - the same path an actual device
 * with genuine v3 data takes, not a simulation of it.
 */
class LegacyDbV3 extends Dexie {
  events!: Table<EventEnvelope, string>
  meta!: Table<{ key: string; value: unknown }, string>
  itemsProj!: Table<unknown, string>
  quarantine!: Table<unknown, string>
  stokProj!: Table<{ itemId: string; quantity: number; lastMovementAt: string; lastMovementEventId: string }, string>
  salesProj!: Table<unknown, string>
  outbox!: Table<{ id: string }, string>

  constructor() {
    super(DB_NAME)
    this.version(1).stores({
      events: 'id, serverSeq, type, occurredAt, recordedAt',
      meta: 'key',
      itemsProj: 'id, nama, kategori',
    })
    this.version(2).stores({ quarantine: 'key, quarantinedAt' })
    this.version(3).stores({
      stokProj: 'itemId',
      salesProj: 'id, occurredAt',
      outbox: 'id',
    })
  }
}

/**
 * Replicates exactly TokoDb's versions 1-4, so opening it seeds a genuine
 * v4 IndexedDB database - the same "already on v4, real sales on disk"
 * state a real device reaches after the prior plan's upgrade, before this
 * plan's version(5) exists.
 */
class LegacyDbV4 extends Dexie {
  events!: Table<EventEnvelope, string>
  meta!: Table<{ key: string; value: unknown }, string>
  itemsProj!: Table<unknown, string>
  quarantine!: Table<unknown, string>
  stokProj!: Table<unknown, string>
  salesProj!: Table<unknown, string>
  outbox!: Table<{ id: string }, string>
  barangProj!: Table<unknown, string>
  suppliersProj!: Table<unknown, string>
  batchesProj!: Table<unknown, string>

  constructor() {
    super(DB_NAME)
    this.version(1).stores({
      events: 'id, serverSeq, type, occurredAt, recordedAt',
      meta: 'key',
      itemsProj: 'id, nama, kategori',
    })
    this.version(2).stores({ quarantine: 'key, quarantinedAt' })
    this.version(3).stores({
      stokProj: 'itemId',
      salesProj: 'id, occurredAt',
      outbox: 'id',
    })
    this.version(4).stores({
      barangProj: 'id, nama',
      suppliersProj: 'id, nama',
      batchesProj: 'batchId, itemId, supplierId, tanggalBeli',
    })
  }
}

beforeEach(async () => {
  await db.delete()
})

afterEach(async () => {
  await db.delete()
})

describe('version(4) upgrade', () => {
  it('upgrades real v3 data: stock totals unchanged, and a pre-existing SupplierUpserted retroactively populates suppliersProj', async () => {
    const legacy = new LegacyDbV3()
    await legacy.open()

    const itemEvent = createEvent('ItemUpserted', {
      id: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak',
      units: [{ unit: 'sak', factor: 1 }], hargaEceran: 52000, stokMinimum: 10,
    }, at('2026-09-10T07:00:00.000Z'))
    const stockEvent = createEvent('StockAdjusted', {
      itemId: 'semen', quantity: 50000, reason: 'initial' as const,
    }, at('2026-09-10T07:00:00.000Z'))
    const saleEvent = createEvent('SaleRecorded', {
      lines: [{ itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 5000, hargaSatuan: 52000, subtotal: 260000 }],
      metodeBayar: 'tunai' as const, subtotal: 260000, diskon: 0, total: 260000,
    }, at('2026-09-12T09:00:00.000Z'))
    const saleAdjust = createEvent('StockAdjusted', {
      itemId: 'semen', quantity: -5000, reason: 'sale' as const, saleId: saleEvent.id,
    }, at('2026-09-12T09:00:00.000Z'))
    const voidEvent = createEvent('SaleVoided', { saleId: saleEvent.id, alasan: 'salah input' }, at('2026-09-12T10:00:00.000Z'))
    const voidAdjust = createEvent('StockAdjusted', {
      itemId: 'semen', quantity: 5000, reason: 'void' as const, saleId: saleEvent.id,
    }, at('2026-09-12T10:00:00.000Z'))
    // Written under Phase 1, before Supplier was ever projected to a table -
    // exactly the case Review Focus calls out.
    const supplierEvent = createEvent('SupplierUpserted', { id: 'sup-1', nama: 'CV Maju' }, at('2026-09-05T07:00:00.000Z'))

    await legacy.events.bulkAdd([itemEvent, stockEvent, saleEvent, saleAdjust, voidEvent, voidAdjust, supplierEvent])
    await legacy.itemsProj.put({
      id: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak', units: [{ unit: 'sak', factor: 1 }],
      hargaEceran: 52000, stokMinimum: 10, updatedAt: itemEvent.recordedAt, updatedByEventId: itemEvent.id,
    })
    await legacy.stokProj.put({ itemId: 'semen', quantity: 50000, lastMovementAt: stockEvent.recordedAt, lastMovementEventId: stockEvent.id })
    legacy.close()

    await db.open()

    const item = await db.itemsProj.get('semen')
    expect(item).toMatchObject({ id: 'semen', nama: 'Semen Tiga Roda' })
    const stock = await db.stokProj.get('semen')
    // The sale and its void cancel out: unchanged from before either happened.
    expect(stock?.quantity).toBe(50000)

    const supplier = await db.suppliersProj.get('sup-1')
    expect(supplier).toMatchObject({ nama: 'CV Maju', perluDilengkapi: false })

    expect(await db.barangProj.toArray()).toEqual([])
    expect(await db.batchesProj.toArray()).toEqual([])
  })

  it('resets the sync cursor to 0, so a device that already synced during the mixed-version rollout re-pulls and recovers any locally zod-stripped fields', async () => {
    const legacy = new LegacyDbV3()
    await legacy.open()
    await legacy.meta.put({ key: 'syncCursor', value: 999 })
    legacy.close()

    await db.open()

    expect(await getCursor()).toBe(0)
  })
})

describe('version(5) upgrade', () => {
  it('backfills itemIds/batchIds for a sale stored before this version, so the new multi-entry indexes find it', async () => {
    const legacy = new LegacyDbV4()
    await legacy.open()

    const saleEvent = createEvent('SaleRecorded', {
      lines: [{ itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000, batchId: 'batch-1' }],
      metodeBayar: 'tunai' as const, subtotal: 63000, diskon: 0, total: 63000,
    }, at('2026-09-18T07:00:00.000Z'))
    await legacy.events.bulkAdd([saleEvent])
    // A genuine pre-v5 row: written by the old reduceSales, which had no
    // itemIds/batchIds fields at all.
    await legacy.salesProj.put({
      id: saleEvent.id, lines: (saleEvent.payload as { lines: unknown }).lines,
      metodeBayar: 'tunai', subtotal: 63000, diskon: 0, total: 63000,
      deliveryIntent: 'dibawa', occurredAt: saleEvent.occurredAt, recordedAt: saleEvent.recordedAt,
      deviceId: 'laptop', status: 'aktif',
    })
    legacy.close()

    await db.open()

    const bySale = await db.salesProj.get(saleEvent.id)
    expect(bySale?.itemIds).toEqual(['semen'])
    expect(bySale?.batchIds).toEqual(['batch-1'])

    const byItemIndex = await db.salesProj.where('itemIds').equals('semen').toArray()
    expect(byItemIndex.map(s => s.id)).toEqual([saleEvent.id])
  })
})
