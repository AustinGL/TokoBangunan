import { describe, it, expect } from 'vitest'
import { computeStokStatus, worstStatus } from './stokStatus'

describe('computeStokStatus', () => {
  it('is habis at zero or below', () => {
    expect(computeStokStatus(0, 10)).toBe('habis')
    expect(computeStokStatus(-5, 10)).toBe('habis')
  })

  it('is menipis below stokMinimum but above zero', () => {
    expect(computeStokStatus(5, 10)).toBe('menipis')
  })

  it('is aman at or above stokMinimum', () => {
    expect(computeStokStatus(10, 10)).toBe('aman')
    expect(computeStokStatus(20, 10)).toBe('aman')
  })
})

describe('worstStatus', () => {
  it('returns aman for an empty list', () => {
    expect(worstStatus([])).toBe('aman')
  })

  it('prefers habis over menipis and aman', () => {
    expect(worstStatus(['aman', 'menipis', 'habis'])).toBe('habis')
  })

  it('prefers menipis over aman when no habis is present', () => {
    expect(worstStatus(['aman', 'menipis'])).toBe('menipis')
  })

  it('returns aman when every status is aman', () => {
    expect(worstStatus(['aman', 'aman'])).toBe('aman')
  })
})
