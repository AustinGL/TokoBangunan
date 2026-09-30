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

  it('measures room against a clipping ancestor (a Sheet body) when it is smaller than the viewport', () => {
    // Viewport says 416px below (roomy), but the sheet body ends 136px under the trigger.
    const trigger = { top: 300, bottom: 352 }
    expect(computePlacement(trigger, 768)).toEqual({ side: 'down', maxHeight: 280 })
    expect(computePlacement(trigger, 768, { top: 100, bottom: 488 })).toEqual({ side: 'up', maxHeight: 188 })
  })

  it('ignores a clipping ancestor that reaches beyond the viewport', () => {
    expect(computePlacement({ top: 100, bottom: 152 }, 768, { top: -500, bottom: 2000 })).toEqual({ side: 'down', maxHeight: 280 })
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

  it('uses the nearest scrolling ancestor as the clip box, not the viewport', () => {
    const body = document.createElement('div')
    body.style.overflowY = 'auto'
    const wrapper = document.createElement('div')
    body.appendChild(wrapper)
    document.body.appendChild(body)
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) })
    body.getBoundingClientRect = () => rect(100, 488)
    wrapper.getBoundingClientRect = () => rect(300, 352)

    try {
      expect(measurePlacement(wrapper)).toEqual({ side: 'up', maxHeight: 188 })
    } finally {
      body.remove()
    }
  })
})
