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

export function computePlacement(rect: { top: number; bottom: number }, viewportHeight: number): PanelPlacement {
  const below = viewportHeight - rect.bottom - EDGE_GAP
  const above = rect.top - EDGE_GAP
  const side = below >= ROOMY || below >= above ? 'down' : 'up'
  const room = side === 'down' ? below : above
  return { side, maxHeight: Math.min(PREFERRED_HEIGHT, Math.max(room, FLOOR)) }
}

export function measurePlacement(el: Element | null): PanelPlacement {
  if (!el) return DEFAULT_PLACEMENT
  // visualViewport follows an on-screen keyboard; jsdom and old browsers lack it.
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  return computePlacement(el.getBoundingClientRect(), viewportHeight)
}
