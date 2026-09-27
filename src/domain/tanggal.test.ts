import { describe, it, expect } from 'vitest'
import { fixedClock } from './clock'
import { dateAtLocalNoon, todayIsoDate } from './tanggal'

describe('dateAtLocalNoon', () => {
  it('builds a Date at local noon for the given calendar day', () => {
    const d = dateAtLocalNoon('2026-09-26')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8) // 0-indexed: September
    expect(d.getDate()).toBe(26)
    expect(d.getHours()).toBe(12)
    expect(d.getMinutes()).toBe(0)
  })

  it('handles a year boundary correctly', () => {
    const d = dateAtLocalNoon('2026-01-01')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })
})

describe('todayIsoDate', () => {
  it('formats the clock\'s current date as yyyy-mm-dd', () => {
    expect(todayIsoDate(fixedClock('2026-09-26T03:15:00.000Z'))).toBe('2026-09-26')
  })

  it('zero-pads single-digit months and days', () => {
    expect(todayIsoDate(fixedClock('2026-01-05T03:15:00.000Z'))).toBe('2026-01-05')
  })
})
