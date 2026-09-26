function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

export type Rgba = { r: number; g: number; b: number; a: number }

/**
 * Parses '#rrggbb' or 'rgba(r, g, b, a)' / 'rgb(r, g, b)' into channel
 * values. Kaca Putih's glass tokens are declared as rgba(...) literals, so
 * the CSS source itself (not a browser) is where those values need to be
 * read, by tokens.test.ts's glass composite group.
 */
export function parseColor(css: string): Rgba {
  const hex = css.trim().match(/^#([0-9A-Fa-f]{6})$/)
  if (hex) {
    const h = hex[1]
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }
  }
  const fn = css.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/)
  if (fn) {
    return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), a: fn[4] === undefined ? 1 : Number(fn[4]) }
  }
  throw new Error(`parseColor: unrecognised colour value "${css}"`)
}

/**
 * Standard alpha "over" compositing: paints `fg` (with its own alpha) on top
 * of the fully opaque `bg`, returning the resulting opaque colour. Used to
 * measure text contrast against Kaca Putih's glass surfaces, which are
 * translucent by design: the colour a reader actually sees is this
 * composite, not --glass-bg's rgba value in isolation and not --background
 * in isolation either.
 */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  if (bg.a !== 1) throw new Error('compositeOver: bg must be fully opaque')
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  }
}

export function toHex(rgba: Rgba): string {
  const c = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${c(rgba.r)}${c(rgba.g)}${c(rgba.b)}`
}
