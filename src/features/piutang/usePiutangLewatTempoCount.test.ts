import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { recordCustomer, recordSale, catatPembayaran } from '../../data/commands'
import { systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'
import { usePiutangLewatTempoCount } from './usePiutangLewatTempoCount'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const ctx = { clock: systemClock, deviceId: 'laptop' }
const bon = (customerId: string, hariLalu: number, total = 100000) => recordSale({
  lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
  metodeBayar: 'bon', customerId, jatuhTempo: isoDateDaysAgo(systemClock, hariLalu),
}, ctx)

describe('usePiutangLewatTempoCount', () => {
  it('is 0 with no piutang, and while it is still loading', async () => {
    const { result } = renderHook(() => usePiutangLewatTempoCount())
    expect(result.current).toBe(0)
    await waitFor(() => expect(result.current).toBe(0))
  })

  it('counts customers who are lewat tempo, not the ones due soon or running', async () => {
    const [a, b, c, d] = await Promise.all(['A', 'B', 'C', 'D'].map(nama => recordCustomer({ nama }, ctx)))
    await bon(a, 5)    // lewat
    await bon(b, 1)    // lewat
    await bon(c, -2)   // segera: no dot
    await bon(d, -30)  // berjalan: no dot
    const { result } = renderHook(() => usePiutangLewatTempoCount())
    await waitFor(() => expect(result.current).toBe(2))
  })

  it('counts a customer once however many overdue notas they have, and drops them once paid', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const first = await bon(budi, 5)
    await bon(budi, 9)
    const { result } = renderHook(() => usePiutangLewatTempoCount())
    await waitFor(() => expect(result.current).toBe(1))

    await catatPembayaran({ saleId: first, jumlah: 100000 }, ctx)
    expect(result.current).toBe(1) // the other nota is still overdue
  })
})
