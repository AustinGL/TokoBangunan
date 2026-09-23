import type { Page } from '@playwright/test'

// Shared real-browser contrast helpers, extracted from shell.spec.ts so
// core-sale.spec.ts can reuse the exact same measurement logic rather than
// re-deriving it. Behavior is unchanged from the original inline copy.

export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const chan = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b)
}

export function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

export function parseRgb(css: string): { r: number; g: number; b: number } {
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
export async function effectiveBackground(page: Page, selector: string): Promise<string> {
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
