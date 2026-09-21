import { describe, it, expect } from 'vitest'
import { projectStock } from './stock'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const adjust = (quantity: number, reason: 'initial' | 'sale' | 'void' = 'initial') => ({
  itemId: 'semen',
  quantity,
  reason,
})

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectStock', () => {
  it('starts empty', () => {
    expect(projectStock([])).toEqual({})
  })

  it('accumulates a positive adjustment', () => {
    const state = projectStock([
      createEvent('StockAdjusted', adjust(10), at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state['semen'].quantity).toBe(10)
  })

  it('accumulates multiple adjustments to the same item, summing rather than overwriting', () => {
    const state = projectStock([
      createEvent('StockAdjusted', adjust(10), at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', adjust(-3), at('2026-09-18T07:01:00.000Z')),
      createEvent('StockAdjusted', adjust(5), at('2026-09-18T07:02:00.000Z')),
    ])
    expect(state['semen'].quantity).toBe(12)
  })

  it('sums to the same running total regardless of fold order (addition is commutative)', () => {
    const events = [
      createEvent('StockAdjusted', adjust(10), at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', adjust(-3), at('2026-09-18T07:01:00.000Z')),
      createEvent('StockAdjusted', adjust(-3), at('2026-09-18T07:02:00.000Z')),
    ]

    const forward = projectStock(events)
    const backward = projectStock([...events].reverse())

    expect(forward['semen'].quantity).toBe(4)
    expect(backward['semen'].quantity).toBe(4)
    expect(forward['semen'].quantity).toBe(backward['semen'].quantity)
  })

  it('converges lastMovementAt/lastMovementEventId to the genuinely latest movement regardless of fold order', () => {
    const first = createEvent('StockAdjusted', adjust(10), at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('StockAdjusted', adjust(-3), at('2026-09-18T09:00:00.000Z'))

    const forward = projectStock([first, second])
    const backward = projectStock([second, first])

    expect(forward['semen'].lastMovementAt).toBe('2026-09-18T09:00:00.000Z')
    expect(forward['semen'].lastMovementEventId).toBe(second.id)
    expect(backward['semen'].lastMovementAt).toBe(forward['semen'].lastMovementAt)
    expect(backward['semen'].lastMovementEventId).toBe(forward['semen'].lastMovementEventId)
  })

  it('breaks a tie on identical recordedAt by event id, independent of fold order', () => {
    // Two adjustments stamped with the exact same recordedAt. `second` is
    // created after `first`, so its UUIDv7 id sorts strictly greater.
    const first = createEvent('StockAdjusted', adjust(10), at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('StockAdjusted', adjust(-4), at('2026-09-18T07:00:00.000Z'))
    expect(second.id > first.id).toBe(true)

    const forward = projectStock([first, second])
    const backward = projectStock([second, first])

    // The running total is unaffected by fold order either way.
    expect(forward['semen'].quantity).toBe(6)
    expect(backward['semen'].quantity).toBe(6)
    // The event with the greater id (minted later) wins the lastMovement tie.
    expect(forward['semen'].lastMovementEventId).toBe(second.id)
    expect(backward['semen'].lastMovementEventId).toBe(second.id)
  })

  it('ignores event types it does not handle', () => {
    const state = projectStock([
      createEvent('SupplierUpserted', { id: 's1', nama: 'Toko Besi Jaya' }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state).toEqual({})
  })

  it('allows a negative running total without throwing', () => {
    const state = projectStock([
      createEvent('StockAdjusted', adjust(-5), at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state['semen'].quantity).toBe(-5)
  })

  it('rejects a zero quantity at createEvent/parse time, not at the reducer', () => {
    expect(() =>
      createEvent('StockAdjusted', adjust(0), at('2026-09-18T07:00:00.000Z')),
    ).toThrow()
  })
})
