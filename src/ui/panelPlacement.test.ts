import { describe, it, expect } from 'vitest'
import { computePlacement, measurePlacement, computeSide, computeGeser, DEFAULT_PLACEMENT } from './panelPlacement'

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

describe('computeSide', () => {
  const rect = { top: 300, bottom: 344 }

  it('opens downward when the card fits below', () => {
    expect(computeSide(rect, 900, undefined, 380)).toBe('down')
  })

  it('flips upward when it does not fit below but there is more room above', () => {
    expect(computeSide({ top: 600, bottom: 644 }, 760, undefined, 380)).toBe('up')
  })

  it('stays downward when it fits on neither side but below has more room', () => {
    expect(computeSide({ top: 100, bottom: 144 }, 400, undefined, 380)).toBe('down')
  })

  it('measures room inside the clipping ancestor, not the whole viewport', () => {
    // a sheet body ending at y=500: the field has 144px below inside it, 288px above
    expect(computeSide({ top: 300, bottom: 344 }, 900, { top: 0, bottom: 500 }, 380)).toBe('up')
  })
})

describe('computeGeser', () => {
  // The card's offset from the field's left edge, in px. Negative moves it left.
  it('does not move the card when it fits to the right of the field', () => {
    expect(computeGeser({ left: 16, right: 360 }, 390, 332)).toBe(0)
  })

  it('lines the card up with the right edge of the field when only that fits', () => {
    // field 250..380 on a 390px screen: a 332px card ends at the right margin (378), starts at 46
    expect(computeGeser({ left: 250, right: 380 }, 390, 332) + 250).toBe(390 - 12 - 332)
  })

  it('when neither edge fits, slides the card to the nearest viewport edge so none of it is cut off', () => {
    // a 664px card, field 312..632 on an 800px screen: right-aligned would start at -32
    expect(computeGeser({ left: 312, right: 632 }, 800, 664)).toBe(12 - 312)
    expect(computeGeser({ left: 312, right: 632 }, 800, 664) + 312).toBeGreaterThanOrEqual(0)
  })

  it('never lets the card start left of the screen margin, even when it is wider than the screen', () => {
    expect(computeGeser({ left: 100, right: 200 }, 300, 332) + 100).toBe(12)
  })

  it('keeps the right end on screen when the field sits at the far right', () => {
    expect(computeGeser({ left: 300, right: 380 }, 390, 332) + 300).toBe(390 - 12 - 332)
  })
})
