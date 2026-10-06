import { laba } from './laba'

/**
 * Beranda's numbers, computed from sales and batch costs. Pure: "now" is
 * passed in (domain/ never reads the wall clock).
 */

export type DashboardSale = {
  status: 'aktif' | 'batal'
  total: number
  occurredAt: string
  lines: Array<{ batchId?: string; qty: number; hargaSatuan: number }>
}

export type DayTotal = { hari: string; penjualan: number; jumlah: number }

export type DashboardSummary = {
  hariIni: DayTotal & {
    /** Laba over the lines whose harga beli is known. Never includes a guessed cost. */
    laba: number
    /** How many of today's lines have a known cost, out of barisTotal. Shown so the figure is never presented as complete when it is not. */
    barisDenganModal: number
    barisTotal: number
  }
  kemarin: DayTotal
  /** Seven local days ending today, oldest first. */
  tujuhHari: DayTotal[]
}

/** yyyy-mm-dd in the device's local time zone. */
export function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysBack(now: Date, n: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n, 12, 0, 0, 0)
}

/**
 * Percent change from `previous` to `current`, rounded to one decimal, or
 * null when there is no previous figure to compare to (never a fake +Infinity).
 */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function summarizeDashboard(
  sales: DashboardSale[],
  hargaBeliByBatch: Record<string, number | undefined>,
  now: Date,
): DashboardSummary {
  const days = Array.from({ length: 7 }, (_, i) => localDayKey(daysBack(now, 6 - i)))
  const totals = new Map<string, DayTotal>(days.map(hari => [hari, { hari, penjualan: 0, jumlah: 0 }]))

  const today = days[6]
  let labaToday = 0
  let barisDenganModal = 0
  let barisTotal = 0

  for (const sale of sales) {
    if (sale.status !== 'aktif') continue
    const hari = localDayKey(new Date(sale.occurredAt))
    const bucket = totals.get(hari)
    if (!bucket) continue
    bucket.penjualan += sale.total
    bucket.jumlah += 1

    if (hari === today) {
      for (const line of sale.lines) {
        barisTotal += 1
        const hargaBeli = line.batchId === undefined ? undefined : hargaBeliByBatch[line.batchId]
        const l = laba(line.hargaSatuan, hargaBeli, line.qty)
        if (l !== null) {
          labaToday += l
          barisDenganModal += 1
        }
      }
    }
  }

  const tujuhHari = days.map(d => totals.get(d)!)
  return {
    hariIni: { ...tujuhHari[6], laba: labaToday, barisDenganModal, barisTotal },
    kemarin: tujuhHari[5],
    tujuhHari,
  }
}
