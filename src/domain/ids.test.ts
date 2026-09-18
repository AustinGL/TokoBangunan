import { describe, it, expect } from 'vitest'
import { newEventId } from './ids'
import { fixedClock, systemClock } from './clock'

describe('newEventId', () => {
  it('produces unique ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newEventId()))
    expect(ids.size).toBe(1000)
  })

  it('produces time-sortable ids (monotonicity check)', () => {
    // Generate a large batch in a tight loop to force many ids into the same
    // millisecond, which is exactly where a time-ordered generator is most likely to break.
    // This checks that ids are ALREADY in sorted order without sorting.
    const ids = Array.from({ length: 10000 }, () => newEventId())
    expect(ids).toEqual([...ids].sort())
  })

  it('generates valid UUIDv7 format', () => {
    // Verify the generated id has UUIDv7 shape: version nibble 7 and variant bits [89ab]
    expect(newEventId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
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
