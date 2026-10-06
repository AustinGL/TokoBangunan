import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from '../../data/db'
import { usePiutang } from './usePiutang'

// A tab left open overnight must not keep showing yesterday's statuses: a Bon due
// today is "segera"; one minute into tomorrow it is lewat tempo, with no data change.

beforeEach(async () => {
  await db.delete()
  await db.open()
})
afterEach(() => { vi.useRealTimers() })

describe('usePiutang across midnight', () => {
  it('turns a Bon due today into lewat tempo when the day changes, without any data change', async () => {
    // Only the clock is faked, and it keeps running: the real timer inside the hook then fires
    // about a second later, when the fake clock has crossed midnight.
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59, 59, 300))
    const now = new Date().toISOString()
    await db.customersProj.put({ id: 'c1', nama: 'Budi', tier: 'eceran', termynHari: 30, updatedAt: now, updatedByEventId: 'e' })
    await db.salesProj.put({
      id: 's1', lines: [], metodeBayar: 'bon', subtotal: 100_000, diskon: 0, total: 100_000, deliveryIntent: 'dibawa',
      occurredAt: now, recordedAt: now, deviceId: 'd', status: 'aktif', itemIds: [], batchIds: [],
      customerId: 'c1', jatuhTempo: '2026-10-05', dibayarAwal: 0,
    })

    const { result } = renderHook(() => usePiutang())
    await waitFor(() => expect(result.current?.pelanggan[0]?.status).toBe('segera'))
    expect(result.current?.jumlahLewatTempo).toBe(0)

    await waitFor(() => expect(result.current?.pelanggan[0]?.status).toBe('lewat'), { timeout: 4000 })
    expect(result.current?.jumlahLewatTempo).toBe(1)
    expect(result.current?.pelanggan[0]?.hariLewat).toBe(1)
  })
})
