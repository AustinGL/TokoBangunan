import { describe, it, expect } from 'vitest'
import { summarizeDashboard, deltaPercent, localDayKey, type DashboardSale } from './dashboard'

const NOW = new Date(2026, 8, 29, 10, 0, 0) // 29 Sep 2026, local

const at = (daysAgo: number, hour = 9): string => new Date(2026, 8, 29 - daysAgo, hour, 0, 0).toISOString()

const sale = (over: Partial<DashboardSale> & Pick<DashboardSale, 'occurredAt'>): DashboardSale => ({
  status: 'aktif', total: 100_000, lines: [{ qty: 1000, hargaSatuan: 100_000 }], ...over,
})

describe('summarizeDashboard', () => {
  it('returns seven days ending today, oldest first, all zero with no sales', () => {
    const s = summarizeDashboard([], {}, NOW)
    expect(s.tujuhHari).toHaveLength(7)
    expect(s.tujuhHari[6].hari).toBe(localDayKey(NOW))
    expect(s.tujuhHari.every(d => d.penjualan === 0 && d.jumlah === 0)).toBe(true)
  })

  it('totals today and yesterday separately', () => {
    const s = summarizeDashboard([
      sale({ occurredAt: at(0), total: 50_000 }), sale({ occurredAt: at(0, 14), total: 70_000 }),
      sale({ occurredAt: at(1), total: 30_000 }),
    ], {}, NOW)
    expect(s.hariIni).toMatchObject({ penjualan: 120_000, jumlah: 2 })
    expect(s.kemarin).toMatchObject({ penjualan: 30_000, jumlah: 1 })
  })

  it('ignores cancelled sales', () => {
    const s = summarizeDashboard([sale({ occurredAt: at(0), status: 'batal' })], {}, NOW)
    expect(s.hariIni.jumlah).toBe(0)
  })

  it('ignores sales older than seven days', () => {
    const s = summarizeDashboard([sale({ occurredAt: at(9) })], {}, NOW)
    expect(s.tujuhHari.reduce((n, d) => n + d.jumlah, 0)).toBe(0)
  })

  it('reads a backdated sale by its business date, not when it was recorded', () => {
    const s = summarizeDashboard([sale({ occurredAt: at(3), total: 40_000 })], {}, NOW)
    expect(s.tujuhHari[3].penjualan).toBe(40_000)
    expect(s.hariIni.penjualan).toBe(0)
  })

  describe('laba (degrades honestly)', () => {
    it('sums laba only over lines with a known harga beli', () => {
      const s = summarizeDashboard([
        sale({
          occurredAt: at(0),
          lines: [
            { batchId: 'b1', qty: 2000, hargaSatuan: 100_000 }, // (100k - 60k) * 2 = 80k
            { batchId: 'b2', qty: 1000, hargaSatuan: 50_000 },  // no cost
            { qty: 1000, hargaSatuan: 10_000 },                 // legacy pool, no batch
          ],
        }),
      ], { b1: 60_000 }, NOW)
      expect(s.hariIni.laba).toBe(80_000)
      expect(s.hariIni.barisDenganModal).toBe(1)
      expect(s.hariIni.barisTotal).toBe(3)
    })

    it('reports zero covered lines instead of a fake zero-cost margin', () => {
      const s = summarizeDashboard([sale({ occurredAt: at(0) })], {}, NOW)
      expect(s.hariIni.barisDenganModal).toBe(0)
      expect(s.hariIni.barisTotal).toBe(1)
    })
  })
})

describe('deltaPercent', () => {
  it('computes percent change to one decimal', () => {
    expect(deltaPercent(110, 100)).toBe(10)
    expect(deltaPercent(93, 100)).toBe(-7)
    expect(deltaPercent(2, 3)).toBe(-33.3)
  })
  it('is null when there is no previous figure', () => {
    expect(deltaPercent(5, 0)).toBeNull()
  })
})
