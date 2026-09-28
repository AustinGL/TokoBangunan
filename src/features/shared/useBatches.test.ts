import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { useBatches } from './useBatches'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const batch = (overrides: Partial<Parameters<typeof db.batchesProj.put>[0]> & { batchId: string; itemId: string; tanggalBeli: string }) =>
  db.batchesProj.put({
    supplierId: undefined, hargaBeli: undefined, hargaJual: 65000, diterima: 40000, sisa: 40000,
    metaUpdatedAt: overrides.tanggalBeli, metaUpdatedByEventId: 'e1',
    lastMovementAt: overrides.tanggalBeli, lastMovementEventId: 'e1',
    ...overrides,
  })

describe('useBatches', () => {
  it('returns only the given item\'s batches, sorted oldest tanggalBeli first', async () => {
    await batch({ batchId: 'b-new', itemId: 'semen', tanggalBeli: '2026-09-15' })
    await batch({ batchId: 'b-old', itemId: 'semen', tanggalBeli: '2026-09-02' })
    await batch({ batchId: 'b-other', itemId: 'pasir', tanggalBeli: '2026-09-01' })

    const { result } = renderHook(() => useBatches('semen'))

    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current!.map(b => b.batchId)).toEqual(['b-old', 'b-new'])
  })

  it('returns an empty array, not undefined, for an item with no batches once the query resolves', async () => {
    const { result } = renderHook(() => useBatches('never-purchased'))

    await waitFor(() => expect(result.current).not.toBeUndefined())
    expect(result.current).toEqual([])
  })
})
