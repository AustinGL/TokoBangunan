import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { aturNamaToko } from '../../data/commands'
import { fixedClock } from '../../domain/clock'
import { useNamaToko } from './useNamaToko'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('useNamaToko', () => {
  it('is null while loading, then an empty string when no name is set', async () => {
    const { result } = renderHook(() => useNamaToko())
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toBe(''))
  })

  it('returns the name once set, and follows a change', async () => {
    await aturNamaToko({ nama: 'Toko Maju' }, at('2026-10-05T07:00:00.000Z'))
    const { result } = renderHook(() => useNamaToko())
    await waitFor(() => expect(result.current).toBe('Toko Maju'))

    await aturNamaToko({ nama: 'Toko Baru' }, at('2026-10-05T08:00:00.000Z'))
    await waitFor(() => expect(result.current).toBe('Toko Baru'))
  })

  it('goes back to an empty string when the name is cleared', async () => {
    await aturNamaToko({ nama: 'Toko Maju' }, at('2026-10-05T07:00:00.000Z'))
    const { result } = renderHook(() => useNamaToko())
    await waitFor(() => expect(result.current).toBe('Toko Maju'))
    await aturNamaToko({ nama: '' }, at('2026-10-05T08:00:00.000Z'))
    await waitFor(() => expect(result.current).toBe(''))
  })
})
