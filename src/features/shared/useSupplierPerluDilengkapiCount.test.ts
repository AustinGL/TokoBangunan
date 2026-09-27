import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { useSupplierPerluDilengkapiCount } from './useSupplierPerluDilengkapiCount'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('useSupplierPerluDilengkapiCount', () => {
  it('counts only suppliers with perluDilengkapi true', async () => {
    await db.suppliersProj.bulkPut([
      { id: 's1', nama: 'CV Maju', perluDilengkapi: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
      { id: 's2', nama: 'UD Sentosa', perluDilengkapi: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2' },
      { id: 's3', nama: 'Toko Jaya', perluDilengkapi: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e3' },
    ])

    const { result } = renderHook(() => useSupplierPerluDilengkapiCount())
    await waitFor(() => expect(result.current).toBe(2))
  })

  it('is 0 before the query resolves and when there are no suppliers at all', async () => {
    const { result } = renderHook(() => useSupplierPerluDilengkapiCount())
    expect(result.current).toBe(0)
    await waitFor(() => expect(result.current).toBe(0))
  })
})
