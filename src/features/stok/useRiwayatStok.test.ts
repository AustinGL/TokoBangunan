import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { recordItem, recordStockPurchase, recordSupplier, recordSale, voidSale } from '../../data/commands'
import { fixedClock } from '../../domain/clock'
import { useRiwayatStok } from './useRiwayatStok'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('useRiwayatStok', () => {
  it('joins supplier name and transaction count onto each batch, newest purchase first', async () => {
    const itemId = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-01T07:00:00.000Z'))
    const supplierId = await recordSupplier({ nama: 'UD Sentosa' }, at('2026-09-01T07:00:00.000Z'))
    const oldBatchId = await recordStockPurchase(
      { itemId, qty: 50, hargaJual: 65000, hargaBeli: 58000, tanggalBeli: new Date('2026-09-02T00:00:00.000Z') },
      at('2026-09-02T07:00:00.000Z'),
    )
    const newBatchId = await recordStockPurchase(
      { itemId, qty: 40, hargaJual: 67000, hargaBeli: 60000, supplierId, tanggalBeli: new Date('2026-09-15T00:00:00.000Z') },
      at('2026-09-15T07:00:00.000Z'),
    )
    await recordSale({
      lines: [{ itemId, nama: 'Semen Tiga Roda', unit: '50 kg', qty: 8000, hargaSatuan: 67000, subtotal: 536000, batchId: newBatchId }],
      metodeBayar: 'tunai',
    }, at('2026-09-16T07:00:00.000Z'))

    const { result } = renderHook(() => useRiwayatStok([{ id: itemId, baseUnit: '50 kg' }]))
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current).toHaveLength(2)
    expect(result.current![0]).toMatchObject({ kind: 'batch', batchId: newBatchId, supplierNama: 'UD Sentosa', transaksiCount: 1, sisa: 32 })
    expect(result.current![1]).toMatchObject({ kind: 'batch', batchId: oldBatchId, supplierNama: undefined, transaksiCount: 0 })
  })

  it('computes a legacy remainder row from stok minus the sum of batch sisa, when nonzero', async () => {
    const itemId = await recordItem({ nama: 'Paku 5cm', baseUnit: 'kg', hargaEceran: 25000, stokMinimum: 5, stokAwal: 20 }, at('2026-09-01T07:00:00.000Z'))
    await recordStockPurchase({ itemId, qty: 30, hargaJual: 25000 }, at('2026-09-05T07:00:00.000Z'))

    const { result } = renderHook(() => useRiwayatStok([{ id: itemId, baseUnit: 'kg' }]))
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current!.find(r => r.kind === 'legacy')).toMatchObject({ sisa: 20, transaksiCount: 0 })
  })

  it('omits the legacy row when every unit of stock is already accounted for by a batch', async () => {
    const itemId = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-01T07:00:00.000Z'))
    await recordStockPurchase({ itemId, qty: 40, hargaJual: 65000 }, at('2026-09-05T07:00:00.000Z'))

    const { result } = renderHook(() => useRiwayatStok([{ id: itemId, baseUnit: '50 kg' }]))
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current!.some(r => r.kind === 'legacy')).toBe(false)
  })

  it('merges batches from multiple ukuran when given more than one item, still ordered newest first', async () => {
    const item50 = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-01T07:00:00.000Z'))
    const item40 = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10 }, at('2026-09-01T07:00:01.000Z'))
    const batch50 = await recordStockPurchase({ itemId: item50, qty: 40, hargaJual: 65000, tanggalBeli: new Date('2026-09-05T00:00:00.000Z') }, at('2026-09-05T07:00:00.000Z'))
    const batch40 = await recordStockPurchase({ itemId: item40, qty: 20, hargaJual: 58000, tanggalBeli: new Date('2026-09-10T00:00:00.000Z') }, at('2026-09-10T07:00:00.000Z'))

    const { result } = renderHook(() => useRiwayatStok([{ id: item50, baseUnit: '50 kg' }, { id: item40, baseUnit: '40 kg' }]))
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current!.map(r => (r.kind === 'batch' ? r.batchId : 'legacy'))).toEqual([batch40, batch50])
  })

  it('counts a legacy sale (no batchId) against the item\'s legacy row, not any batch', async () => {
    const itemId = await recordItem({ nama: 'Paku 5cm', baseUnit: 'kg', hargaEceran: 25000, stokMinimum: 5, stokAwal: 20 }, at('2026-09-01T07:00:00.000Z'))
    await recordSale({
      lines: [{ itemId, nama: 'Paku 5cm', unit: 'kg', qty: 5000, hargaSatuan: 25000, subtotal: 125000 }],
      metodeBayar: 'tunai',
    }, at('2026-09-02T07:00:00.000Z'))

    const { result } = renderHook(() => useRiwayatStok([{ id: itemId, baseUnit: 'kg' }]))
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current!.find(r => r.kind === 'legacy')).toMatchObject({ transaksiCount: 1 })
  })

  it('does not double-count a single sale whose lines span two of the requested items', async () => {
    // Exercises the .distinct() guard on the salesProj.itemIds multi-entry
    // index query: without it, a sale matching anyOf(itemIds) on more than
    // one of its own lines' items can come back more than once from Dexie,
    // and the per-batch tally loop would then double-increment every batch
    // that sale touches.
    const item50 = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-01T07:00:00.000Z'))
    const item40 = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: '40 kg', hargaEceran: 58000, stokMinimum: 10 }, at('2026-09-01T07:00:01.000Z'))
    const batch50 = await recordStockPurchase({ itemId: item50, qty: 40, hargaJual: 65000 }, at('2026-09-05T07:00:00.000Z'))
    const batch40 = await recordStockPurchase({ itemId: item40, qty: 20, hargaJual: 58000 }, at('2026-09-06T07:00:00.000Z'))
    await recordSale({
      lines: [
        { itemId: item50, nama: 'Semen Tiga Roda', unit: '50 kg', qty: 1000, hargaSatuan: 65000, subtotal: 65000, batchId: batch50 },
        { itemId: item40, nama: 'Semen Tiga Roda', unit: '40 kg', qty: 1000, hargaSatuan: 58000, subtotal: 58000, batchId: batch40 },
      ],
      metodeBayar: 'tunai',
    }, at('2026-09-10T07:00:00.000Z'))

    const { result } = renderHook(() => useRiwayatStok([{ id: item50, baseUnit: '50 kg' }, { id: item40, baseUnit: '40 kg' }]))
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current!.find(r => r.kind === 'batch' && r.batchId === batch50)).toMatchObject({ transaksiCount: 1 })
    expect(result.current!.find(r => r.kind === 'batch' && r.batchId === batch40)).toMatchObject({ transaksiCount: 1 })
  })

  it('excludes a voided sale from transaksiCount', async () => {
    const itemId = await recordItem({ nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 }, at('2026-09-01T07:00:00.000Z'))
    const batchId = await recordStockPurchase({ itemId, qty: 40, hargaJual: 65000 }, at('2026-09-05T07:00:00.000Z'))
    const saleId = await recordSale({
      lines: [{ itemId, nama: 'Semen Tiga Roda', unit: '50 kg', qty: 8000, hargaSatuan: 65000, subtotal: 520000, batchId }],
      metodeBayar: 'tunai',
    }, at('2026-09-06T07:00:00.000Z'))
    await voidSale(saleId, 'Salah input', at('2026-09-07T07:00:00.000Z'))

    const { result } = renderHook(() => useRiwayatStok([{ id: itemId, baseUnit: '50 kg' }]))
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current!.find(r => r.kind === 'batch' && r.batchId === batchId)).toMatchObject({ transaksiCount: 0 })
  })

  it('returns an empty array, not undefined, when given no items', async () => {
    const { result } = renderHook(() => useRiwayatStok([]))
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current).toEqual([])
  })
})
