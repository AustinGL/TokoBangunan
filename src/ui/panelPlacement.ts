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
