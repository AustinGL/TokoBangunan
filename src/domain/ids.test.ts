import { describe, it, expect } from 'vitest'
import { newEventId } from './ids'
import { fixedClock, systemClock } from './clock'

describe('newEventId', () => {
  it('produces unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newEventId()))
    expect(ids.size).toBe(1000)
  })

  it('produces time-sortable ids', () => {
    const a = newEventId()
    const b = newEventId()
    expect([a, b].sort()).toEqual([a, b])
  })
})

describe('fixedClock', () => {
  it('always returns the same instant', () => {
    const clock = fixedClock('2026-09-18T07:30:00.000Z')
    expect(clock.now().toISOString()).toBe('2026-09-18T07:30:00.000Z')
    expect(clock.now().toISOString()).toBe('2026-09-18T07:30:00.000Z')
  })
})

describe('systemClock', () => {
  it('returns a Date', () => {
    expect(systemClock.now()).toBeInstanceOf(Date)
  })
})
