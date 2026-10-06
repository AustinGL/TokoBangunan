/**
 * Where a dropdown panel opens. Fields at the bottom of a Sheet (Kasir's
 * inline create, Tambah stok) have no room below, so the panel flips upward
 * instead of being cut off. Measured once, when the list opens, from the
 * caller's event handler: no effect, no re-measure while open.
 */
export type PanelPlacement = { side: 'down' | 'up'; maxHeight: number }

export const DEFAULT_PLACEMENT: PanelPlacement = { side: 'down', maxHeight: 280 }

const PREFERRED_HEIGHT = 280
const EDGE_GAP = 12 // keep clear of the viewport edge
const ROOMY = 160   // below this much room, prefer whichever side has more
const FLOOR = 96    // never shrink the panel below roughly two rows

type Clip = { top: number; bottom: number }

/**
 * `clip` is the visible box of the nearest scrolling ancestor (a Sheet body
 * clips everything that overflows it, and overflow above its top can never be
 * scrolled to), intersected with the viewport. Room is what is left of the
 * trigger inside that box.
 */
export function computePlacement(rect: { top: number; bottom: number }, viewportHeight: number, clip?: Clip): PanelPlacement {
  const floor = Math.max(0, clip?.top ?? 0)
  const ceiling = Math.min(viewportHeight, clip?.bottom ?? viewportHeight)
  const below = ceiling - rect.bottom - EDGE_GAP
  const above = rect.top - floor - EDGE_GAP
  const side = below >= ROOMY || below >= above ? 'down' : 'up'
  const room = side === 'down' ? below : above
  return { side, maxHeight: Math.min(PREFERRED_HEIGHT, Math.max(room, FLOOR)) }
}

/** Rect of the nearest ancestor that clips or scrolls its overflow, or undefined if only the viewport does. */
function clippingAncestorRect(el: Element): Clip | undefined {
  for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
    if (getComputedStyle(a).overflowY !== 'visible') {
      const { top, bottom } = a.getBoundingClientRect()
      return { top, bottom }
    }
  }
  return undefined
}

export function measurePlacement(el: Element | null): PanelPlacement {
  if (!el) return DEFAULT_PLACEMENT
  // visualViewport follows an on-screen keyboard; jsdom and old browsers lack it.
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  return computePlacement(el.getBoundingClientRect(), viewportHeight, clippingAncestorRect(el))
}

/**
 * Up or down for a card of known height (a calendar), by the same room rule as
 * computePlacement: the room left of the trigger inside its clipping ancestor.
 * Down unless it does not fit below and there is more room above.
 */
export function computeSide(rect: { top: number; bottom: number }, viewportHeight: number, clip: Clip | undefined, needed: number): 'down' | 'up' {
  const floor = Math.max(0, clip?.top ?? 0)
  const ceiling = Math.min(viewportHeight, clip?.bottom ?? viewportHeight)
  const below = ceiling - rect.bottom - EDGE_GAP
  const above = rect.top - floor - EDGE_GAP
  return below >= needed || below >= above ? 'down' : 'up'
}

export function measureSide(el: Element | null, needed: number): 'down' | 'up' {
  if (!el) return 'down'
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  return computeSide(el.getBoundingClientRect(), viewportHeight, clippingAncestorRect(el), needed)
}

/**
 * How far (px, negative = leftward) a card of width `lebar` should sit from the
 * field's left edge. It starts at the field's left edge, lines up with the
 * field's right edge when it would run off the right side, and in every case is
 * slid back inside the screen margins, so none of it is cut off and the page
 * never scrolls sideways. The left margin wins when the card is wider than the screen.
 */
export function computeGeser(rect: { left: number; right: number }, viewportWidth: number, lebar: number): number {
  let x = rect.left
  if (x + lebar > viewportWidth - EDGE_GAP) x = rect.right - lebar
  x = Math.min(x, viewportWidth - EDGE_GAP - lebar)
  x = Math.max(x, EDGE_GAP)
  return x - rect.left
}

export function measureGeser(el: Element | null, lebar: number): number {
  if (!el) return 0
  return computeGeser(el.getBoundingClientRect(), window.innerWidth, lebar)
}
