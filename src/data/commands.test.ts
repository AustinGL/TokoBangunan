import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { recordItem } from './commands'
import { fixedClock } from '../domain/clock'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('recordItem', () => {
  it('writes exactly one ItemUpserted event and no StockAdjusted event when stokAwal is omitted', async () => {
    await recordItem(
      { nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 52000, stokMinimum: 10 },
      at('2026-09-18T07:00:00.000Z'),
    )

    const events = await db.events.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('ItemUpserted')

    // Proves the write went through appendEvents (not some other path): the
    // incremental fold populated itemsProj from the same call.
    const items = await db.itemsProj.toArray()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ nama: 'Semen Tiga Roda', hargaEceran: 52000 })
  })

  it('writes both events atomically when stokAwal is given, converting to milli-units at the base-unit factor', async () => {
    const id = await recordItem(
      { nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 52000, stokMinimum: 10, stokAwal: 50 },
      at('2026-09-18T07:00:00.000Z'),
    )

    const events = await db.events.toArray()
    expect(events).toHaveLength(2)
    const stockEvent = events.find(e => e.type === 'StockAdjusted')
    expect(stockEvent).toBeDefined()
    // 50 sak at base-unit factor 1, milli-unit resolution: 50 * 1 * 1000 = 50000.
    expect(stockEvent!.payload).toMatchObject({ itemId: id, quantity: 50000, reason: 'initial' })

    const stock = await db.stokProj.toArray()
    expect(stock).toHaveLength(1)
    expect(stock[0]).toMatchObject({ itemId: id, quantity: 50000 })
  })

  it('writes no StockAdjusted event when stokAwal is 0', async () => {
    await recordItem(
      { nama: 'Pasir', baseUnit: 'm3', hargaEceran: 180000, stokMinimum: 1, stokAwal: 0 },
      at('2026-09-18T07:00:00.000Z'),
    )

    const events = await db.events.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('ItemUpserted')
    expect(await db.stokProj.toArray()).toHaveLength(0)
  })

  it('writes no StockAdjusted event when stokAwal is not provided at all', async () => {
    await recordItem(
      { nama: 'Pasir', baseUnit: 'm3', hargaEceran: 180000, stokMinimum: 1 },
      at('2026-09-18T07:00:00.000Z'),
    )

    expect(await db.events.toArray()).toHaveLength(1)
    expect(await db.stokProj.toArray()).toHaveLength(0)
  })

  it('returns the generated item id, and both events reference the same id', async () => {
    const id = await recordItem(
      { nama: 'Besi Beton', baseUnit: 'batang', hargaEceran: 65000, stokMinimum: 5, stokAwal: 20 },
      at('2026-09-18T07:00:00.000Z'),
    )

    const events = await db.events.toArray()
    const itemEvent = events.find(e => e.type === 'ItemUpserted')!
    const stockEvent = events.find(e => e.type === 'StockAdjusted')!

    expect((itemEvent.payload as { id: string }).id).toBe(id)
    expect((stockEvent.payload as { itemId: string }).itemId).toBe(id)
  })

  it('derives units as [{ unit: baseUnit, factor: 1 }], never asked from the input', async () => {
    await recordItem(
      { nama: 'Cat Tembok', baseUnit: 'kaleng', hargaEceran: 95000, stokMinimum: 3 },
      at('2026-09-18T07:00:00.000Z'),
    )

    const [event] = await db.events.toArray()
    expect((event.payload as { units: unknown }).units).toEqual([{ unit: 'kaleng', factor: 1 }])
  })
})
