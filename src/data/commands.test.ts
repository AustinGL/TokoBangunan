import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import {
  recordItem, recordSale, voidSale, recordBarang, updateBarang, recordUkuran, updateUkuran,
  recordSupplier, updateSupplier, recordStockPurchase, type RecordSaleInput,
} from './commands'
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

describe('recordSale', () => {
  it('writes one SaleRecorded and one StockAdjusted event atomically for a single-line cart, and both projections reflect it', async () => {
    const cart: RecordSaleInput = {
      lines: [
        // 3 sak at Rp 52.000/sak, milli-qty 3000: subtotal = 52000 * 3000 / 1000 = 156000.
        { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 3000, hargaSatuan: 52000, subtotal: 156000 },
      ],
      metodeBayar: 'tunai',
      uangDiterima: 200000,
    }

    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))

    const events = await db.events.toArray()
    expect(events).toHaveLength(2)

    const saleEvent = events.find(e => e.type === 'SaleRecorded')!
    expect(saleEvent.id).toBe(saleId)
    expect(saleEvent.payload).toMatchObject({
      subtotal: 156000,
      diskon: 0,
      total: 156000,
      metodeBayar: 'tunai',
      uangDiterima: 200000,
      deliveryIntent: 'dibawa',
    })

    const stockEvent = events.find(e => e.type === 'StockAdjusted')!
    // A sale deducts stock: the cart line's qty (3000, positive) becomes -3000.
    expect(stockEvent.payload).toMatchObject({
      itemId: 'semen',
      quantity: -3000,
      reason: 'sale',
      saleId,
    })

    const sales = await db.salesProj.toArray()
    expect(sales).toHaveLength(1)
    expect(sales[0]).toMatchObject({ id: saleId, subtotal: 156000, total: 156000, status: 'aktif' })

    const stock = await db.stokProj.toArray()
    expect(stock).toHaveLength(1)
    expect(stock[0]).toMatchObject({ itemId: 'semen', quantity: -3000 })
  })

  it('writes N+1 events atomically for a multi-line cart and sums subtotal/total correctly', async () => {
    const cart: RecordSaleInput = {
      lines: [
        // 3 sak at Rp 52.000/sak: 52000 * 3000 / 1000 = 156000.
        { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 3000, hargaSatuan: 52000, subtotal: 156000 },
        // 2 m3 at Rp 180.000/m3: 180000 * 2000 / 1000 = 360000.
        { itemId: 'pasir', nama: 'Pasir', unit: 'm3', qty: 2000, hargaSatuan: 180000, subtotal: 360000 },
      ],
      metodeBayar: 'tunai',
    }

    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))

    const events = await db.events.toArray()
    // 1 SaleRecorded + 2 StockAdjusted = 3 events, one appendEvents call.
    expect(events).toHaveLength(3)
    expect(events.filter(e => e.type === 'StockAdjusted')).toHaveLength(2)

    const saleEvent = events.find(e => e.type === 'SaleRecorded')!
    // Sum: 156000 + 360000 = 516000. diskon is always 0, so total === subtotal.
    expect(saleEvent.payload).toMatchObject({ subtotal: 516000, diskon: 0, total: 516000 })

    const stockEvents = events.filter(e => e.type === 'StockAdjusted')
    const bySemen = stockEvents.find(e => (e.payload as { itemId: string }).itemId === 'semen')!
    const byPasir = stockEvents.find(e => (e.payload as { itemId: string }).itemId === 'pasir')!
    expect(bySemen.payload).toMatchObject({ quantity: -3000, saleId })
    expect(byPasir.payload).toMatchObject({ quantity: -2000, saleId })

    const stock = await db.stokProj.toArray()
    expect(stock).toHaveLength(2)

    const sales = await db.salesProj.toArray()
    expect(sales).toHaveLength(1)
    expect(sales[0].lines).toHaveLength(2)
  })

  it('always hardcodes diskon to 0, so total equals subtotal', async () => {
    const cart: RecordSaleInput = {
      lines: [
        { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 1000, hargaSatuan: 52000, subtotal: 52000 },
      ],
      metodeBayar: 'tunai',
    }

    await recordSale(cart, at('2026-09-18T08:00:00.000Z'))

    const [saleEvent] = (await db.events.toArray()).filter(e => e.type === 'SaleRecorded')
    const payload = saleEvent.payload as { subtotal: number; diskon: number; total: number }
    expect(payload.diskon).toBe(0)
    expect(payload.total).toBe(payload.subtotal)
  })

  it('returns the sale id, matching the written SaleRecorded event id', async () => {
    const cart: RecordSaleInput = {
      lines: [
        { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 1000, hargaSatuan: 52000, subtotal: 52000 },
      ],
      metodeBayar: 'tunai',
    }

    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))

    const [saleEvent] = (await db.events.toArray()).filter(e => e.type === 'SaleRecorded')
    expect(saleEvent.id).toBe(saleId)
  })
})

describe('voidSale', () => {
  it('writes one SaleVoided and one StockAdjusted(void) reversing the sale, and both projections reflect it', async () => {
    // Before: -3000 (sale deduction). qty 3000 reversed by +3000: after = 0.
    const cart: RecordSaleInput = {
      lines: [
        { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 3000, hargaSatuan: 52000, subtotal: 156000 },
      ],
      metodeBayar: 'tunai',
    }
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))

    const stockBeforeVoid = await db.stokProj.get('semen')
    expect(stockBeforeVoid?.quantity).toBe(-3000)

    await voidSale(saleId, 'Salah input', at('2026-09-18T09:00:00.000Z'))

    const events = await db.events.toArray()
    // 1 SaleRecorded + 1 StockAdjusted('sale') + 1 SaleVoided + 1 StockAdjusted('void') = 4.
    expect(events).toHaveLength(4)

    const voidEvent = events.find(e => e.type === 'SaleVoided')!
    expect(voidEvent.payload).toMatchObject({ saleId, alasan: 'Salah input' })

    const reversalEvent = events.find(e => e.type === 'StockAdjusted' && (e.payload as { reason: string }).reason === 'void')!
    expect(reversalEvent.payload).toMatchObject({ itemId: 'semen', quantity: 3000, reason: 'void', saleId })

    const sale = await db.salesProj.get(saleId)
    expect(sale?.status).toBe('batal')
    expect(sale?.voidedReason).toBe('Salah input')

    // -3000 (sale) + 3000 (void reversal) = 0: the deduction is fully undone.
    const stockAfterVoid = await db.stokProj.get('semen')
    expect(stockAfterVoid?.quantity).toBe(0)
  })

  it('reverses every line of a multi-line sale, not just the first', async () => {
    const cart: RecordSaleInput = {
      lines: [
        { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 3000, hargaSatuan: 52000, subtotal: 156000 },
        { itemId: 'pasir', nama: 'Pasir', unit: 'm3', qty: 2000, hargaSatuan: 180000, subtotal: 360000 },
      ],
      metodeBayar: 'tunai',
    }
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))

    await voidSale(saleId, 'Batal dari pelanggan', at('2026-09-18T09:00:00.000Z'))

    const events = await db.events.toArray()
    const reversalEvents = events.filter(e => e.type === 'StockAdjusted' && (e.payload as { reason: string }).reason === 'void')
    expect(reversalEvents).toHaveLength(2)

    const semenReversal = reversalEvents.find(e => (e.payload as { itemId: string }).itemId === 'semen')!
    const pasirReversal = reversalEvents.find(e => (e.payload as { itemId: string }).itemId === 'pasir')!
    expect(semenReversal.payload).toMatchObject({ quantity: 3000, saleId })
    expect(pasirReversal.payload).toMatchObject({ quantity: 2000, saleId })

    // Each line's deduction (-3000, -2000) is exactly undone by its reversal.
    const semenStock = await db.stokProj.get('semen')
    const pasirStock = await db.stokProj.get('pasir')
    expect(semenStock?.quantity).toBe(0)
    expect(pasirStock?.quantity).toBe(0)
  })

  it('throws on a nonexistent sale id and writes nothing', async () => {
    await expect(voidSale('no-such-sale', 'Alasan apapun', at('2026-09-18T09:00:00.000Z')))
      .rejects.toThrow('Transaksi tidak ditemukan.')

    expect(await db.events.count()).toBe(0)
  })

  it('throws on an already-batal sale and does not double-adjust stokProj (the load-bearing double-void guard)', async () => {
    const cart: RecordSaleInput = {
      lines: [
        { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 3000, hargaSatuan: 52000, subtotal: 156000 },
      ],
      metodeBayar: 'tunai',
    }
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    await voidSale(saleId, 'Salah input', at('2026-09-18T09:00:00.000Z'))

    const eventCountAfterFirstVoid = await db.events.count()
    // -3000 (sale) + 3000 (first void reversal) = 0.
    const stockAfterFirstVoid = await db.stokProj.get('semen')
    expect(stockAfterFirstVoid?.quantity).toBe(0)

    await expect(voidSale(saleId, 'Coba lagi', at('2026-09-18T10:00:00.000Z')))
      .rejects.toThrow('Transaksi sudah dibatalkan.')

    // No new events at all from the rejected second call.
    expect(await db.events.count()).toBe(eventCountAfterFirstVoid)

    // The load-bearing assertion: if the guard were missing, a second void
    // would append a second +3000 StockAdjusted('void'), taking quantity to
    // 3000 even though reduceSales would still (idempotently) report the
    // sale as 'batal'. Proving quantity is STILL 0, not 3000, is what shows
    // stock was not silently double-reversed.
    const stockAfterSecondAttempt = await db.stokProj.get('semen')
    expect(stockAfterSecondAttempt?.quantity).toBe(0)

    const sale = await db.salesProj.get(saleId)
    expect(sale?.status).toBe('batal')
  })
})

describe('recordSale: batchId/hargaNormal', () => {
  it('carries batchId and hargaNormal through onto the SaleRecorded line and the sale StockAdjusted', async () => {
    const saleId = await recordSale({
      lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000, batchId: 'batch-1', hargaNormal: 65000 }],
      metodeBayar: 'tunai',
    }, at('2026-09-18T07:00:00.000Z'))

    const sale = await db.salesProj.get(saleId)
    expect(sale?.lines[0]).toMatchObject({ batchId: 'batch-1', hargaNormal: 65000 })

    const events = await db.events.toArray()
    const stockEvent = events.find(e => e.type === 'StockAdjusted')
    expect(stockEvent?.payload).toMatchObject({ batchId: 'batch-1', reason: 'sale' })
  })

  it('omits batchId entirely for a legacy line with none', async () => {
    await recordSale({
      lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000 }],
      metodeBayar: 'tunai',
    }, at('2026-09-18T07:00:00.000Z'))

    const events = await db.events.toArray()
    const stockEvent = events.find(e => e.type === 'StockAdjusted')
    expect((stockEvent?.payload as { batchId?: string }).batchId).toBeUndefined()
  })
})

describe('voidSale: batchId reversal', () => {
  it('reverses each line against its own original batch', async () => {
    const saleId = await recordSale({
      lines: [
        { itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000, batchId: 'batch-1' },
        { itemId: 'pasir', nama: 'Pasir', unit: 'm3', qty: 500, hargaSatuan: 180000, subtotal: 90000 },
      ],
      metodeBayar: 'tunai',
    }, at('2026-09-18T07:00:00.000Z'))

    await voidSale(saleId, 'salah input', at('2026-09-18T08:00:00.000Z'))

    const events = await db.events.toArray()
    const voidAdjustments = events.filter(e => e.type === 'StockAdjusted' && (e.payload as { reason: string }).reason === 'void')
    const semenVoid = voidAdjustments.find(e => (e.payload as { itemId: string }).itemId === 'semen')
    const pasirVoid = voidAdjustments.find(e => (e.payload as { itemId: string }).itemId === 'pasir')
    expect((semenVoid?.payload as { batchId?: string }).batchId).toBe('batch-1')
    expect((pasirVoid?.payload as { batchId?: string }).batchId).toBeUndefined()
  })
})

describe('recordBarang', () => {
  it('writes a BarangUpserted event, defaulting diarsipkan to false', async () => {
    const id = await recordBarang({ nama: 'Semen Tiga Roda', kategori: 'Semen' }, at('2026-09-18T07:00:00.000Z'))

    const events = await db.events.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('BarangUpserted')

    const barang = await db.barangProj.get(id)
    expect(barang).toMatchObject({ nama: 'Semen Tiga Roda', kategori: 'Semen', diarsipkan: false })
  })
})

describe('updateBarang', () => {
  it('rejects an id that does not exist', async () => {
    await expect(updateBarang({ id: 'ghost', nama: 'X' }, at('2026-09-18T07:00:00.000Z'))).rejects.toThrow('tidak ditemukan')
  })

  it('preserves fields not given in the input', async () => {
    const id = await recordBarang({ nama: 'Semen Tiga Roda', kategori: 'Semen' }, at('2026-09-18T07:00:00.000Z'))

    await updateBarang({ id, nama: 'Semen Tiga Roda 50kg' }, at('2026-09-18T08:00:00.000Z'))

    const barang = await db.barangProj.get(id)
    expect(barang).toMatchObject({ nama: 'Semen Tiga Roda 50kg', kategori: 'Semen' })
  })

  it('archives a barang by setting diarsipkan', async () => {
    const id = await recordBarang({ nama: 'Semen Tiga Roda' }, at('2026-09-18T07:00:00.000Z'))

    await updateBarang({ id, diarsipkan: true }, at('2026-09-18T08:00:00.000Z'))

    expect((await db.barangProj.get(id))?.diarsipkan).toBe(true)
  })

  it('clears kategori when explicitly given null', async () => {
    const id = await recordBarang({ nama: 'Semen Tiga Roda', kategori: 'Semen' }, at('2026-09-18T07:00:00.000Z'))

    await updateBarang({ id, kategori: null }, at('2026-09-18T08:00:00.000Z'))

    expect((await db.barangProj.get(id))?.kategori).toBeUndefined()
  })
})

describe('recordUkuran', () => {
  it('rejects a barangId that does not exist', async () => {
    await expect(
      recordUkuran({ barangId: 'ghost', ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-18T07:00:00.000Z')),
    ).rejects.toThrow('tidak ditemukan')
  })

  it('creates an item snapshotting the parent barang\'s nama and kategori', async () => {
    const barangId = await recordBarang({ nama: 'Semen Tiga Roda', kategori: 'Semen' }, at('2026-09-18T07:00:00.000Z'))

    const ukuranId = await recordUkuran(
      { barangId, ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10 },
      at('2026-09-18T07:01:00.000Z'),
    )

    const item = await db.itemsProj.get(ukuranId)
    expect(item).toMatchObject({
      nama: 'Semen Tiga Roda', kategori: 'Semen', baseUnit: '50 kg', barangId, hargaEceran: 65000, diarsipkan: false,
    })
  })
})

describe('updateUkuran', () => {
  it('rejects an id that does not exist', async () => {
    await expect(updateUkuran({ id: 'ghost', hargaEceran: 1 }, at('2026-09-18T07:00:00.000Z'))).rejects.toThrow('tidak ditemukan')
  })

  it('preserves fields not given in the input', async () => {
    const barangId = await recordBarang({ nama: 'Semen Tiga Roda' }, at('2026-09-18T07:00:00.000Z'))
    const ukuranId = await recordUkuran(
      { barangId, ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10, barcode: '123' },
      at('2026-09-18T07:01:00.000Z'),
    )

    await updateUkuran({ id: ukuranId, hargaEceran: 67000 }, at('2026-09-18T08:00:00.000Z'))

    const item = await db.itemsProj.get(ukuranId)
    expect(item).toMatchObject({ hargaEceran: 67000, baseUnit: '50 kg', barcode: '123', stokMinimum: 10 })
  })

  it('moves an ukuran to another barang, updating its nama/kategori snapshot and keeping its own price', async () => {
    const semenId = await recordBarang({ nama: 'Semen Tiga Roda', kategori: 'Semen' }, at('2026-09-18T07:00:00.000Z'))
    const semenGudangId = await recordBarang({ nama: 'Semen Gudang Garam', kategori: 'Semen' }, at('2026-09-18T07:01:00.000Z'))
    const ukuranId = await recordUkuran(
      { barangId: semenId, ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10 },
      at('2026-09-18T07:02:00.000Z'),
    )

    await updateUkuran({ id: ukuranId, barangId: semenGudangId }, at('2026-09-18T08:00:00.000Z'))

    const item = await db.itemsProj.get(ukuranId)
    expect(item).toMatchObject({ barangId: semenGudangId, nama: 'Semen Gudang Garam', hargaEceran: 65000 })
  })

  it('moving to a barang with no kategori clears the ukuran\'s kategori, rather than keeping the old barang\'s', async () => {
    const semenId = await recordBarang({ nama: 'Semen Tiga Roda', kategori: 'Semen' }, at('2026-09-18T07:00:00.000Z'))
    const pakuId = await recordBarang({ nama: 'Paku' }, at('2026-09-18T07:01:00.000Z'))
    const ukuranId = await recordUkuran(
      { barangId: semenId, ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10 },
      at('2026-09-18T07:02:00.000Z'),
    )

    await updateUkuran({ id: ukuranId, barangId: pakuId }, at('2026-09-18T08:00:00.000Z'))

    const item = await db.itemsProj.get(ukuranId)
    expect(item).toMatchObject({ barangId: pakuId, nama: 'Paku' })
    expect(item?.kategori).toBeUndefined()
  })

  it('clears the barcode when explicitly given null', async () => {
    const barangId = await recordBarang({ nama: 'Semen Tiga Roda' }, at('2026-09-18T07:00:00.000Z'))
    const ukuranId = await recordUkuran(
      { barangId, ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10, barcode: '999' },
      at('2026-09-18T07:01:00.000Z'),
    )

    await updateUkuran({ id: ukuranId, barcode: null }, at('2026-09-18T08:00:00.000Z'))

    expect((await db.itemsProj.get(ukuranId))?.barcode).toBeUndefined()
  })

  it('archives an ukuran by setting diarsipkan', async () => {
    const barangId = await recordBarang({ nama: 'Semen Tiga Roda' }, at('2026-09-18T07:00:00.000Z'))
    const ukuranId = await recordUkuran(
      { barangId, ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10 },
      at('2026-09-18T07:01:00.000Z'),
    )

    await updateUkuran({ id: ukuranId, diarsipkan: true }, at('2026-09-18T08:00:00.000Z'))

    expect((await db.itemsProj.get(ukuranId))?.diarsipkan).toBe(true)
  })

  it('leaves barangId undefined for a legacy item whose update does not set one', async () => {
    // Simulates an item that predates Kamus Barang (recordItem, not
    // recordUkuran): no barangId to begin with, and an update that only
    // touches price must not invent one.
    const legacyId = await recordItem(
      { nama: 'Paku 5cm', baseUnit: 'kg', hargaEceran: 25000, stokMinimum: 5 },
      at('2026-09-18T07:00:00.000Z'),
    )

    await updateUkuran({ id: legacyId, hargaEceran: 27000 }, at('2026-09-18T08:00:00.000Z'))

    const item = await db.itemsProj.get(legacyId)
    expect(item?.barangId).toBeUndefined()
    expect(item?.hargaEceran).toBe(27000)
  })
})

describe('recordSupplier', () => {
  it('defaults perluDilengkapi to false for an ordinary create', async () => {
    const id = await recordSupplier({ nama: 'CV Maju' }, at('2026-09-18T07:00:00.000Z'))

    const supplier = await db.suppliersProj.get(id)
    expect(supplier).toMatchObject({ nama: 'CV Maju', perluDilengkapi: false })
  })

  it('sets perluDilengkapi when quickAdd is true', async () => {
    const id = await recordSupplier({ nama: 'UD Baru', quickAdd: true }, at('2026-09-18T07:00:00.000Z'))

    expect((await db.suppliersProj.get(id))?.perluDilengkapi).toBe(true)
  })
})

describe('updateSupplier', () => {
  it('rejects an id that does not exist', async () => {
    await expect(updateSupplier({ id: 'ghost', nama: 'X' }, at('2026-09-18T07:00:00.000Z'))).rejects.toThrow('tidak ditemukan')
  })

  it('preserves fields not given in the input and clears perluDilengkapi', async () => {
    const id = await recordSupplier({ nama: 'UD Baru', quickAdd: true }, at('2026-09-18T07:00:00.000Z'))

    await updateSupplier({ id, telepon: '0812' }, at('2026-09-18T08:00:00.000Z'))

    const supplier = await db.suppliersProj.get(id)
    expect(supplier).toMatchObject({ nama: 'UD Baru', telepon: '0812', perluDilengkapi: false })
  })

  it('clears telepon when explicitly given null, without touching alamat/kontak/catatan', async () => {
    const id = await recordSupplier({ nama: 'CV Maju', telepon: '0812', alamat: 'Jl. Merdeka 1' }, at('2026-09-18T07:00:00.000Z'))

    await updateSupplier({ id, telepon: null }, at('2026-09-18T08:00:00.000Z'))

    const supplier = await db.suppliersProj.get(id)
    expect(supplier?.telepon).toBeUndefined()
    expect(supplier?.alamat).toBe('Jl. Merdeka 1')
  })
})

describe('recordStockPurchase', () => {
  it('rejects an itemId that does not exist', async () => {
    await expect(
      recordStockPurchase({ itemId: 'ghost', qty: 40, hargaJual: 67000 }, at('2026-09-18T07:00:00.000Z')),
    ).rejects.toThrow('tidak ditemukan')
  })

  it('writes a StockReceived event converting qty to milli-units at the base-unit factor', async () => {
    const itemId = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-18T07:00:00.000Z'))

    const batchId = await recordStockPurchase(
      { itemId, qty: 40, hargaBeli: 60000, hargaJual: 67000, supplierId: 'sup-1' },
      at('2026-09-18T07:01:00.000Z'),
    )

    const batch = await db.batchesProj.get(batchId)
    expect(batch).toMatchObject({ itemId, supplierId: 'sup-1', hargaBeli: 60000, hargaJual: 67000, diterima: 40000, sisa: 40000 })
  })

  it('does not touch ItemUpserted when hargaJual matches the current default', async () => {
    const itemId = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-18T07:00:00.000Z'))

    await recordStockPurchase({ itemId, qty: 40, hargaJual: 65000 }, at('2026-09-18T07:01:00.000Z'))

    const events = await db.events.toArray()
    expect(events.filter(e => e.type === 'ItemUpserted')).toHaveLength(1) // only the original recordItem
  })

  it('re-saves the item with the new hargaJual as its default when it differs', async () => {
    const itemId = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-18T07:00:00.000Z'))

    await recordStockPurchase({ itemId, qty: 40, hargaJual: 67000 }, at('2026-09-18T07:01:00.000Z'))

    expect((await db.itemsProj.get(itemId))?.hargaEceran).toBe(67000)
  })

  it('uses tanggalBeli as the event\'s occurredAt when given', async () => {
    const itemId = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-18T07:00:00.000Z'))

    await recordStockPurchase(
      { itemId, qty: 40, hargaJual: 65000, tanggalBeli: new Date('2026-09-15T00:00:00.000Z') },
      at('2026-09-18T07:01:00.000Z'),
    )

    const received = (await db.events.toArray()).find(e => e.type === 'StockReceived')
    expect(received?.occurredAt).toBe('2026-09-15T00:00:00.000Z')
  })
})
