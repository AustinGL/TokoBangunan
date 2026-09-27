import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { useKatalog } from './useKatalog'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const seedBarang = (id: string, nama: string, kategori?: string) =>
  db.barangProj.put({ id, nama, kategori, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e0' })

const seedUkuran = (overrides: { id: string; barangId?: string; nama: string; baseUnit: string; hargaEceran: number; stokMinimum: number; kategori?: string }) =>
  db.itemsProj.put({
    id: overrides.id, nama: overrides.nama, baseUnit: overrides.baseUnit,
    units: [{ unit: overrides.baseUnit, factor: 1 }], hargaEceran: overrides.hargaEceran,
    stokMinimum: overrides.stokMinimum, kategori: overrides.kategori, barangId: overrides.barangId,
    diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })

describe('useKatalog', () => {
  it('groups ukuran under their barang, with each ukuran\'s quantity converted to whole units', async () => {
    await seedBarang('b1', 'Semen Tiga Roda', 'Semen')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })
    await db.stokProj.put({ itemId: 'u1', quantity: 32000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e2' })

    const { result } = renderHook(() => useKatalog())
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current).toHaveLength(1)
    expect(result.current![0]).toMatchObject({ barangId: 'b1', nama: 'Semen Tiga Roda', kategori: 'Semen' })
    expect(result.current![0].ukuran[0]).toMatchObject({ id: 'u1', ukuran: '50 kg', quantity: 32, status: 'aman' })
  })

  it('gives a legacy item with no barangId its own virtual barang', async () => {
    await seedUkuran({ id: 'legacy-1', nama: 'Paku 5cm', baseUnit: 'kg', hargaEceran: 25000, stokMinimum: 5 })

    const { result } = renderHook(() => useKatalog())
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current).toHaveLength(1)
    expect(result.current![0]).toMatchObject({ barangId: 'item-legacy-1', nama: 'Paku 5cm' })
  })

  it('treats an ukuran with no stokProj row at all as quantity 0', async () => {
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran({ id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', hargaEceran: 65000, stokMinimum: 10 })

    const { result } = renderHook(() => useKatalog())
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current![0].ukuran[0]).toMatchObject({ quantity: 0, status: 'habis' })
  })
})
