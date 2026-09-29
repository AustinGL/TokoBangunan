import { describe, it, expect } from 'vitest'
import { computePlacement, measurePlacement, DEFAULT_PLACEMENT } from './panelPlacement'

describe('computePlacement', () => {
  it('opens downward at full height when there is room below', () => {
    expect(computePlacement({ top: 100, bottom: 152 }, 768)).toEqual({ side: 'down', maxHeight: 280 })
  })

  it('opens upward when the trigger is near the bottom and there is more room above', () => {
    expect(computePlacement({ top: 650, bottom: 702 }, 768)).toEqual({ side: 'up', maxHeight: 280 })
  })

  it('shrinks to the room available, but never below two rows', () => {
    // 200px viewport: 48px below, 78px above -> up, floored at 96.
    expect(computePlacement({ top: 90, bottom: 140 }, 200)).toEqual({ side: 'up', maxHeight: 96 })
  })

  it('stays downward when neither side is roomy but below has at least as much', () => {
    expect(computePlacement({ top: 100, bottom: 152 }, 300)).toEqual({ side: 'down', maxHeight: 136 })
  })
})

describe('measurePlacement', () => {
  it('falls back to the default when there is no element', () => {
    expect(measurePlacement(null)).toEqual(DEFAULT_PLACEMENT)
  })

  it('measures a real element against the viewport (jsdom rects are zero, so: roomy, downward)', () => {
    const el = document.createElement('div')
    expect(measurePlacement(el).side).toBe('down')
  })
})
