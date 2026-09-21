import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { computeStokStatus, useStokList } from './useStokList'

describe('computeStokStatus', () => {
  it('is habis at exactly 0', () => {
    expect(computeStokStatus(0, 10)).toBe('habis')
  })

  it('is habis below 0 (a legal negative running total)', () => {
    expect(computeStokStatus(-2, 10)).toBe('habis')
  })

  it('is menipis one unit below stokMinimum', () => {
    expect(computeStokStatus(9, 10)).toBe('menipis')
  })

  it('is aman at exactly stokMinimum', () => {
    expect(computeStokStatus(10, 10)).toBe('aman')
  })

  it('is aman comfortably above stokMinimum', () => {
    expect(computeStokStatus(50, 10)).toBe('aman')
  })
})

describe('useStokList (live join over real fake-indexeddb)', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('treats an item with no stokProj row at all as quantity 0 and status habis', async () => {
    await db.itemsProj.put({
      id: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak',
      units: [{ unit: 'sak', factor: 1 }], hargaEceran: 52000, stokMinimum: 10,
      updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
    })

    const { result } = renderHook(() => useStokList())

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current).toHaveLength(1)
    expect(result.current![0]).toMatchObject({ itemId: 'semen', quantity: 0, status: 'habis' })
  })

  it('converts stokProj milli-units back to whole units for the join, matching fromBase', async () => {
    await db.itemsProj.put({
      id: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak',
      units: [{ unit: 'sak', factor: 1 }], hargaEceran: 52000, stokMinimum: 10,
      updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
    })
    // 50 sak stored as 50000 milli-sak (factor 1 base unit).
    await db.stokProj.put({ itemId: 'semen', quantity: 50000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e2' })

    const { result } = renderHook(() => useStokList())

    await waitFor(() => expect(result.current).toBeDefined())
    expect(result.current![0]).toMatchObject({ quantity: 50, status: 'aman' })
  })

  it('is undefined before the first query resolves (loading convention)', () => {
    const { result } = renderHook(() => useStokList())
    expect(result.current).toBeUndefined()
  })
})
