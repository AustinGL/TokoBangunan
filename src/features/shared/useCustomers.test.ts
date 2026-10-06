import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { useCustomers } from './useCustomers'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const row = (id: string, nama: string) => ({ id, nama, tier: 'eceran' as const, termynHari: 30, updatedAt: 't', updatedByEventId: 'e' })

describe('useCustomers', () => {
  it('returns customers sorted by nama once the query resolves', async () => {
    await db.customersProj.bulkPut([row('c2', 'Sari'), row('c1', 'Budi')])
    const { result } = renderHook(() => useCustomers())
    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current!.map(c => c.nama)).toEqual(['Budi', 'Sari'])
  })

  it('returns an empty array, not undefined, when there are none', async () => {
    const { result } = renderHook(() => useCustomers())
    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current).toEqual([])
  })
})
