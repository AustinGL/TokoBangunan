import type { Page } from '@playwright/test'

/**
 * Waits until every finite animation and transition on the page has finished.
 *
 * Cards, sheets and rows enter with a short translate/scale. A `boundingBox()` taken while that
 * runs reads a 44px control as 43.99998px (or a card a few percent small), and how far along the
 * animation is depends on how busy the machine is, so a size check without this passes or fails
 * by luck. Infinite animations (skeleton shimmer, status pulses) are skipped: they never finish.
 */
export const animasiSelesai = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
        .map(a => a.finished.catch(() => undefined)),
    ),
  )
