import { test, expect, type Page } from '@playwright/test'

// Real-browser checks for the app shell. jsdom never paints, so nothing here
// duplicates the Vitest suite: these tests exist specifically for computed
// layout, prefers-color-scheme, and rendered pixel colour.

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const chan = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b)
}

function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

function parseRgb(css: string): { r: number; g: number; b: number } {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) throw new Error(`could not parse colour: ${css}`)
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
}

// Walk up from an element to find the first non-transparent background, the
// same resolution algorithm a browser uses when compositing text. Falls back
// to the true default canvas colour (white) if nothing up the chain painted
// one, never to a raw `rgba(0, 0, 0, 0)` string: a naive alpha-blind regex
// would parse that as opaque black, which scores a HIGH contrast ratio
// against white text and would silently pass the exact failure this test
// exists to catch, white text painted on the real white canvas.
async function effectiveBackground(page: Page, selector: string): Promise<string> {
  const raw = await page.locator(selector).evaluate((el) => {
    let node: Element | null = el
    while (node) {
      const bg = getComputedStyle(node).backgroundColor
      const m = bg.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/)
      const alpha = m && m[1] !== undefined ? Number(m[1]) : 1
      if (bg && alpha > 0) return bg
      node = node.parentElement
    }
    return 'transparent'
  })
  const m = raw.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/)
  const alpha = m && m[1] !== undefined ? Number(m[1]) : 1
  return alpha > 0 ? raw : 'rgb(255, 255, 255)'
}

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

  test('all six destinations sit on a single line, no wrap', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation')
    const box = await nav.boundingBox()
    expect(box, 'nav did not render').not.toBeNull()

    const linkTops = await nav.getByRole('link').evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().top),
    )
    expect(linkTops.length).toBeGreaterThanOrEqual(6)
    // Every link's top edge should be within a couple pixels of the first:
    // wrapping to a second row would push later items down by a full
    // line-height, which is a much larger delta than font rendering jitter.
    const first = linkTops[0]
    for (const top of linkTops) {
      expect(Math.abs(top - first)).toBeLessThan(4)
    }
  })

  test('every nav target and the primary button render at least 44px tall', async ({ page }) => {
    await page.goto('/')
    const targets = page.locator('header a, header button')
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
    const bar = page.locator('nav').last()
    const targets = bar.locator('a, button, [tabindex]')
    await expect(targets).toHaveCount(5)
  })

  test('the FAB and all four tabs render at least 44px tall', async ({ page }) => {
    await page.goto('/')
    const bar = page.locator('nav').last()
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
