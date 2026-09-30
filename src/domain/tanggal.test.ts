import { describe, it, expect } from 'vitest'
import { fixedClock } from './clock'
import { dateAtLocalNoon, todayIsoDate, isoDateDaysAgo } from './tanggal'

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

describe('isoDateDaysAgo', () => {
  const clock = fixedClock('2026-09-29T10:00:00.000Z')

  it('is today for 0 and yesterday for 1', () => {
    expect(isoDateDaysAgo(clock, 0)).toBe('2026-09-29')
    expect(isoDateDaysAgo(clock, 1)).toBe('2026-09-28')
  })

  it('crosses a month boundary', () => {
    expect(isoDateDaysAgo(fixedClock('2026-10-01T10:00:00.000Z'), 1)).toBe('2026-09-30')
  })

  it('crosses a year boundary', () => {
    expect(isoDateDaysAgo(fixedClock('2026-01-01T10:00:00.000Z'), 1)).toBe('2025-12-31')
  })
})
