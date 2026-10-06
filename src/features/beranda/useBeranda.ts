import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { systemClock } from '../../domain/clock'
import { useHariIni } from '../shared/useHariIni'
import { summarizeDashboard, type DashboardSummary } from '../../domain/dashboard'
import type { Sale } from '../../domain/projections/sales'

export type BerandaData = {
  summary: DashboardSummary
  recent: Sale[]
}

/**
 * Reads what Beranda's metric and chart cards need: the last week of sales
 * (by business date, so a backdated sale lands on the day it belongs to),
 * every batch's harga beli for laba, and the five newest sales for the
 * "Transaksi terakhir" card. The arithmetic itself is domain/dashboard.ts.
 * Stock rows come from useKatalog, read separately by the screen.
 */
export function useBeranda(): BerandaData | undefined {
  // The 7-day window moves at midnight even when no data changes.
  const hariIni = useHariIni()
  return useLiveQuery(async () => {
    const now = systemClock.now()
    // A day of slack before the 7-day window: summarizeDashboard does the
    // exact local-day bucketing, this only bounds the index scan.
    const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8).toISOString()

    const [week, batches, recent] = await Promise.all([
      db.salesProj.where('occurredAt').aboveOrEqual(since).toArray(),
      db.batchesProj.toArray(),
      db.salesProj.orderBy('occurredAt').reverse().limit(5).toArray(),
    ])

    const hargaBeliByBatch = Object.fromEntries(batches.map(b => [b.batchId, b.hargaBeli]))
    return { summary: summarizeDashboard(week, hargaBeliByBatch, now), recent }
  }, [hariIni])
}
