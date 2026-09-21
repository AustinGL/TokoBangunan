import { describe, it, expect } from 'vitest'
import { rupiah, add, subtract, multiplyByQty, percentOf, allocate, formatRupiah } from './money'

describe('rupiah', () => {
  it('rejects non-integers', () => {
    expect(() => rupiah(1500.5)).toThrow(/integer/)
  })
})

describe('arithmetic', () => {
  it('adds and subtracts', () => {
    expect(add(rupiah(52000), rupiah(180000))).toBe(232000)
    expect(subtract(rupiah(232000), rupiah(80000))).toBe(152000)
  })

  it('multiplies a price by a milli-unit quantity', () => {
    // 2 sak at Rp 52.000 => qty 2000 milli-sak
    expect(multiplyByQty(rupiah(52000), 2000)).toBe(104000)
  })

  it('rounds fractional quantities to whole rupiah', () => {
    // 1.5 m3 at Rp 180.000 => 270.000
    expect(multiplyByQty(rupiah(180000), 1500)).toBe(270000)
    // 0.333 sak at Rp 52.000 => 17.316 => 17.316 rounded
    expect(multiplyByQty(rupiah(52000), 333)).toBe(17316)
  })

  it('computes a percentage, rounding half up', () => {
    expect(percentOf(rupiah(284000), 5)).toBe(14200)
    expect(percentOf(rupiah(333), 50)).toBe(167)
  })
})

describe('allocate', () => {
  it('splits exactly, losing no rupiah', () => {
    const parts = allocate(rupiah(100), [1, 1, 1])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100)
    expect(parts).toEqual([34, 33, 33])
  })

  it('weights proportionally', () => {
    expect(allocate(rupiah(1000), [3, 1])).toEqual([750, 250])
  })

  it('preserves the total for many random splits', () => {
    for (let i = 0; i < 500; i++) {
      const total = Math.floor(Math.random() * 1_000_000)
      const weights = Array.from(
        { length: 1 + Math.floor(Math.random() * 6) },
        () => 1 + Math.floor(Math.random() * 100),
      )
      const parts = allocate(rupiah(total), weights)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      expect(parts.every(p => p >= 0)).toBe(true)
    }
  })

  it('rejects zero total weight', () => {
    expect(() => allocate(rupiah(100), [0, 0])).toThrow(/weight/)
  })

  it('rejects an individual negative weight even when the total stays positive', () => {
    // [-1, 3] sums to a positive 2, so the total-weight guard alone lets it
    // through and the caller silently receives a part with the opposite sign
    // to the total. There is no meaningful negative share of a bill here.
    expect(() => allocate(rupiah(100), [-1, 3])).toThrow(/weight/)
  })

  it('rejects a non-finite weight', () => {
    expect(() => allocate(rupiah(100), [Number.NaN, 1])).toThrow(/weight/)
    expect(() => allocate(rupiah(100), [Number.POSITIVE_INFINITY, 1])).toThrow(/weight/)
  })

  it('still accepts a zero weight alongside positive ones', () => {
    expect(allocate(rupiah(100), [0, 1])).toEqual([0, 100])
  })
})

describe('formatRupiah', () => {
  it('formats with dot separators and a Rp prefix', () => {
    expect(formatRupiah(rupiah(1320000))).toBe('Rp 1.320.000')
  })

  it('formats negatives with a leading minus and a space', () => {
    expect(formatRupiah(rupiah(-80000))).toBe('- Rp 80.000')
  })
})
