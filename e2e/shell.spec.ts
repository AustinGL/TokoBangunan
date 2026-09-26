import { test, expect } from '@playwright/test'
import { contrastRatio, parseRgb, effectiveBackground } from './contrast'

// Real-browser checks for the app shell. jsdom never paints, so nothing here
// duplicates the Vitest suite: these tests exist specifically for computed
// layout, prefers-color-scheme, and rendered pixel colour.
//
// The contrast-measurement helpers (effectiveBackground/contrastRatio/
// parseRgb) live in ./contrast.ts so core-sale.spec.ts can reuse the exact
// same logic instead of re-deriving it.

test.describe('page shell actually renders readable text', () => {
  // This is the direct regression test for the 2026-09-21 bug: the document
  // had no background or text colour of its own, so dark-theme --ink (near
  // white) rendered on a browser-default white page. Every component
  // consumed its design tokens correctly; the page shell did not. A jsdom
  // suite cannot see this because jsdom never paints.
  //
  // The store name only renders in the desktop header (`hidden md:flex`);
  // BottomNav carries no equivalent text label, so phone viewports check the
  // "Beranda" page heading instead, and desktop checks the store name. Both
  // sit directly on the page background, which is what this test is for.
  test('desktop: the store name is readable against its actual rendered background', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'store name only renders in the desktop header')
    await page.goto('/')
    const heading = page.getByText('Toko Bahan Bangunan')
    await expect(heading).toBeVisible()

    const textColor = await heading.evaluate((el) => getComputedStyle(el).color)
    const bgColor = await effectiveBackground(page, 'text=Toko Bahan Bangunan')

    const ratio = contrastRatio(parseRgb(textColor), parseRgb(bgColor))
    expect(ratio, `text ${textColor} on background ${bgColor}`).toBeGreaterThanOrEqual(4.5)
  })

  test('phone: the page heading is readable against its actual rendered background', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'covered by the desktop store-name check above')
    await page.goto('/')
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()

    const textColor = await heading.evaluate((el) => getComputedStyle(el).color)
    const bgColor = await effectiveBackground(page, 'h1')

    const ratio = contrastRatio(parseRgb(textColor), parseRgb(bgColor))
    expect(ratio, `text ${textColor} on background ${bgColor}`).toBeGreaterThanOrEqual(4.5)
  })

  test('the page background is not left at the browser default', async ({ page }) => {
    await page.goto('/')
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    // Neither pure white nor pure transparent/unset. A real token value is
    // always some shade of the off-white or near-black scale, never exactly
    // rgb(255, 255, 255) or a fully transparent fallback.
    expect(bodyBg).not.toBe('rgba(0, 0, 0, 0)')
    expect(bodyBg).not.toBe('rgb(255, 255, 255)')
  })
})

test.describe('desktop navigation', () => {
  test.skip(({ isMobile }) => !!isMobile, 'desktop-only layout check')

  test('all seven destinations sit in a single vertical column, not wrapped into rows or columns', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' })
    const box = await nav.boundingBox()
    expect(box, 'sidebar nav did not render').not.toBeNull()

    const linkLefts = await nav.getByRole('link').evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().left),
    )
    expect(linkLefts.length).toBeGreaterThanOrEqual(7)
    // Every link's left edge should be within a couple pixels of the first:
    // a vertical column keeps every item at the same horizontal position,
    // unlike the old horizontal bar (which pinned top edges instead).
    const first = linkLefts[0]
    for (const left of linkLefts) {
      expect(Math.abs(left - first)).toBeLessThan(4)
    }
  })

  test('every nav target and the primary button render at least 44px tall', async ({ page }) => {
    await page.goto('/')
    const targets = page.locator('aside a, aside button')
    const count = await targets.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox()
      expect(box, `target ${i} has no box`).not.toBeNull()
      expect(box!.height, `target ${i} height`).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('phone navigation', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone-only layout check')

  test('bottom bar carries at most five targets total', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'Navigasi telepon' })
    const targets = bar.locator('a, button, [tabindex]')
    await expect(targets).toHaveCount(5)
  })

  test('the FAB and every bottom-bar tab render at least 44px tall', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'Navigasi telepon' })
    const targets = bar.locator('a, button')
    const count = await targets.count()
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('keyboard focus', () => {
  test('a focused nav link shows a visible outline', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
    const outline = await focused.evaluate((el) => {
      const s = getComputedStyle(el)
      return { style: s.outlineStyle, width: s.outlineWidth }
    })
    expect(outline.style).not.toBe('none')
    expect(parseFloat(outline.width)).toBeGreaterThan(0)
  })
})
