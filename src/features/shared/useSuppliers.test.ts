import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { useSuppliers } from './useSuppliers'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('useSuppliers', () => {
  it('returns every supplier sorted by nama', async () => {
    await db.suppliersProj.bulkPut([
      { id: 's2', nama: 'UD Sentosa', perluDilengkapi: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2' },
      { id: 's1', nama: 'CV Maju', perluDilengkapi: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
    ])

    const { result } = renderHook(() => useSuppliers())
    await waitFor(() => expect(result.current).toBeDefined())

    expect(result.current!.map(s => s.nama)).toEqual(['CV Maju', 'UD Sentosa'])
  })

  it('returns an empty array, not undefined-forever, when there are no suppliers', async () => {
    const { result } = renderHook(() => useSuppliers())
    await waitFor(() => expect(result.current).toEqual([]))
  })
})
