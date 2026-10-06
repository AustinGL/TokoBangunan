import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import type { Sale } from '../../domain/projections/sales'
import { useLaporan } from './useLaporan'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const TS = '2026-09-18T07:00:00.000Z'
const now = () => new Date().toISOString()

const seedSale = (over: Partial<Sale> & Pick<Sale, 'id' | 'occurredAt'>) =>
  db.salesProj.put({
    lines: [{ itemId: 'u1', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 100_000, subtotal: 100_000, batchId: 'b1' }],
    metodeBayar: 'tunai', subtotal: 100_000, diskon: 0, total: 100_000, deliveryIntent: 'dibawa',
    recordedAt: over.occurredAt, deviceId: 'd1', status: 'aktif', itemIds: ['u1'], batchIds: ['b1'], ...over,
  })

describe('useLaporan', () => {
  it('is undefined while loading, then summarises today\'s sale with its kategori and cost', async () => {
    await db.barangProj.put({ id: 'br1', nama: 'Semen', kategori: 'Semen', diarsipkan: false, updatedAt: TS, updatedByEventId: 'e' })
    await db.itemsProj.put({ id: 'u1', nama: 'Semen', baseUnit: 'sak', units: [{ unit: 'sak', factor: 1 }], hargaEceran: 100_000, stokMinimum: 0, barangId: 'br1', diarsipkan: false, updatedAt: TS, updatedByEventId: 'e' })
    await db.batchesProj.put({ batchId: 'b1', itemId: 'u1', hargaBeli: 60_000, hargaJual: 100_000, tanggalBeli: now(), diterima: 10_000, sisa: 9_000, metaUpdatedAt: TS, metaUpdatedByEventId: 'e', lastMovementAt: TS, lastMovementEventId: 'e' })
    await seedSale({ id: 's1', occurredAt: now() })

    const { result } = renderHook(() => useLaporan('hari-ini'))
    expect(result.current).toBeUndefined()

    await waitFor(() => expect(result.current).not.toBeUndefined())
    const { sekarang, sebelumnya, rentang } = result.current!
    expect(rentang.from).toBe(rentang.to)
    expect(sekarang).toMatchObject({ penjualan: 100_000, jumlahTransaksi: 1, labaKotor: 40_000, belanjaStok: 600_000 })
    expect(sekarang.perKategori[0]).toMatchObject({ kategori: 'Semen', margin: 40 })
    expect(sebelumnya.jumlahTransaksi).toBe(0)
  })

  it('returns empty summaries (not undefined) when there is no data', async () => {
    const { result } = renderHook(() => useLaporan('bulan-ini'))
    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current!.sekarang).toMatchObject({ penjualan: 0, labaKotor: null, jumlahTransaksi: 0 })
  })

  it('puts a sale from the previous period into sebelumnya, not sekarang', async () => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(12, 0, 0, 0)
    await seedSale({ id: 's-old', occurredAt: yesterday.toISOString() })
    const { result } = renderHook(() => useLaporan('hari-ini'))
    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current!.sekarang.jumlahTransaksi).toBe(0)
    expect(result.current!.sebelumnya.jumlahTransaksi).toBe(1)
  })

  it('summarises a custom range and its equal-length previous range', async () => {
    await seedSale({ id: 's-in', occurredAt: new Date(2026, 9, 12, 10).toISOString() })
    await seedSale({ id: 's-prev', occurredAt: new Date(2026, 9, 8, 10).toISOString(), total: 50_000 })
    await seedSale({ id: 's-out', occurredAt: new Date(2026, 9, 20, 10).toISOString() })

    const { result } = renderHook(() => useLaporan({ from: '2026-10-10', to: '2026-10-14' }))
    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current!.rentang).toEqual({ from: '2026-10-10', to: '2026-10-14' })
    expect(result.current!.sekarang).toMatchObject({ jumlahTransaksi: 1, penjualan: 100_000 })
    expect(result.current!.sebelumnya).toMatchObject({ jumlahTransaksi: 1, penjualan: 50_000 })
  })

  it('does not re-query when re-rendered with an equal range object', async () => {
    const { result, rerender } = renderHook(({ r }) => useLaporan(r), { initialProps: { r: { from: '2026-10-10', to: '2026-10-14' } } })
    await waitFor(() => expect(result.current).not.toBeUndefined())
    const first = result.current
    rerender({ r: { from: '2026-10-10', to: '2026-10-14' } })
    expect(result.current).toBe(first)
  })

  it('counts a payment received in the period as uang masuk, and a Bon as penjualan only', async () => {
    await seedSale({ id: 's-bon', occurredAt: now(), metodeBayar: 'bon', customerId: 'c1', jatuhTempo: '2099-01-01', dibayarAwal: 20_000 })
    await db.paymentsProj.put({ id: 'p1', saleId: 's-bon', jumlah: 30_000, occurredAt: now(), recordedAt: now(), deviceId: 'd1' })

    const { result } = renderHook(() => useLaporan('hari-ini'))
    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current!.sekarang).toMatchObject({ penjualan: 100_000, uangMasuk: 50_000, arusKas: 50_000 })
  })

  it('counts a backdated payment in the month it was received, not the month it was written', async () => {
    const lalu = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 10, 12)
    await db.paymentsProj.put({ id: 'p-lalu', saleId: 's-bon', jumlah: 70_000, occurredAt: lalu.toISOString(), recordedAt: now(), deviceId: 'd1' })

    const pad = (n: number) => String(n).padStart(2, '0')
    const bulanLalu = { from: `${lalu.getFullYear()}-${pad(lalu.getMonth() + 1)}-01`, to: `${lalu.getFullYear()}-${pad(lalu.getMonth() + 1)}-28` }
    const ini = renderHook(() => useLaporan('bulan-ini'))
    const itu = renderHook(() => useLaporan(bulanLalu))
    await waitFor(() => expect(ini.result.current).not.toBeUndefined())
    await waitFor(() => expect(itu.result.current).not.toBeUndefined())

    expect(ini.result.current!.sekarang.uangMasuk).toBe(0)
    expect(itu.result.current!.sekarang.uangMasuk).toBe(70_000)
  })
})

