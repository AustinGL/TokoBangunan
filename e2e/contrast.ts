import type { Page } from '@playwright/test'

// Shared real-browser contrast helpers, extracted from shell.spec.ts so
// core-sale.spec.ts can reuse the exact same measurement logic rather than
// re-deriving it. relativeLuminance, contrastRatio and parseRgb are
// unchanged from the original: only effectiveBackground's internal
// behaviour changes (see its own doc comment).

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

type Rgba = { r: number; g: number; b: number; a: number }

/**
 * Like parseRgb, but keeps the alpha channel (defaulting to 1 for a bare
 * rgb(...) or an rgba(...) with no fourth value). Returns null rather than
 * throwing for unparseable input: an ancestor chain can legitimately
 * contain a layer with no paintable colour at all, which
 * effectiveBackground below needs to skip, not abort on.
 */
function parseRgba(css: string): Rgba | null {
  const m = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!m) return null
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) }
}

/** Standard alpha "over" compositing: paints `fg` (with its own alpha) on top of the fully opaque `bg`. */
function compositeOver(fg: Rgba, bg: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  return {
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
  }
}

/**
 * Walks from `selector` up through every ancestor (including html and
 * body), then composites each one's computed background-color in real
 * paint order: the outermost ancestor first, each descendant's own
 * background-color layered on top via standard alpha "over" compositing.
 * Every descendant must still be visited after an opaque ancestor: an opaque
 * page canvas does not prevent a card or navigation rail from painting over
 * it later in the chain.
 *
 * This replaces the previous "first non-transparent layer wins" approach,
 * correct for every original surface (fully opaque --surface,
 * --background, ...) but silently wrong for Kaca Putih's translucent
 * .glass chrome (rgba(255, 255, 255, .72)): the old logic returned that
 * translucent rgba string as if it were the final colour a reader sees,
 * instead of compositing it over the ambient page gradient actually
 * showing through it.
 */
export async function effectiveBackground(page: Page, selector: string): Promise<string> {
  const layers = await page.locator(selector).evaluate((el) => {
    const chain: string[] = []
    let node: Element | null = el
    while (node) {
      chain.push(getComputedStyle(node).backgroundColor)
      node = node.parentElement
    }
    return chain
  })

  let result = { r: 255, g: 255, b: 255 } // the true browser default canvas colour
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const rgba = parseRgba(layers[i])
    if (rgba === null || rgba.a === 0) continue
    result = compositeOver(rgba, result)
  }
  return `rgb(${result.r}, ${result.g}, ${result.b})`
}
