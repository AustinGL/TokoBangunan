import { describe, it, expect } from 'vitest'
import { laba } from './laba'

describe('laba', () => {
  it('computes (hargaSatuan - hargaBeli) * qty at qty 1000 milli-units (1 whole unit)', () => {
    expect(laba(67000, 60000, 1000)).toBe(7000)
  })

  it('scales with qty', () => {
    expect(laba(67000, 60000, 2000)).toBe(14000)
  })

  it('returns null when hargaBeli is unknown, never a fake zero-cost margin', () => {
    expect(laba(67000, undefined, 1000)).toBeNull()
  })

  it('is negative when sold below cost', () => {
    expect(laba(55000, 60000, 1000)).toBe(-5000)
  })
})
