// @vitest-environment node
// This file reads tokens.css from disk via node:fs. The project's default test
// environment is jsdom, whose faked import.meta.url is not a file:// URL, so
// readFileSync(new URL(...)) throws "The URL must be of scheme file" there.
// Overriding to the node environment for just this file fixes that without
// touching the global jsdom config the rest of the suite relies on.
//
// tsconfig.app.json intentionally omits Node ambient types (app code runs in
// the browser). This file is the one exception, so it opts in locally via a
// triple-slash reference instead of adding "node" to the app-wide types list,
// which would leak Node globals into every browser file under src/.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { contrastRatio, parseColor, compositeOver, toHex } from './contrast'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function token(name: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token ${name} not found in tokens.css`)
  return m[1]
}

function rgbaToken(name: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*(rgba?\\([^)]*\\))`))
  if (!m) throw new Error(`token ${name} not found in tokens.css`)
  return m[1]
}

describe('contrast ledger (Kaca Putih v2)', () => {
  // Each pair is expressed as the primitives its semantic tokens resolve to
  // in tokens.css (semantic tokens like --ink-muted hold a var(...)
  // reference, not a hex literal, so the token() regex above can't read them
  // directly). 'WHITE' stands for both the literal #FFFFFF and --surface's
  // value, which is itself the literal #FFFFFF (tokens.css's own --surface
  // declaration).
  const cases: Array<[string, string, string, number]> = [
    ['ink-on-primary on primary (CTA)',   'WHITE',        '--cobalt-600', 4.5],
    ['ink-on-primary on primary-hover',   'WHITE',        '--cobalt-700', 4.5],
    ['ink-on-primary on primary-active',  'WHITE',        '--cobalt-800', 4.5],
    ['ink on surface',                    '--grey-900',   'WHITE',        4.5],
    ['ink on background',                 '--grey-900',   '--background', 4.5],
    ['ink-muted on background',           '--grey-600',   '--background', 4.5],
    ['ink-faint on surface',              '--grey-550',   'WHITE',        4.5],
    ['ink-faint on background',           '--grey-550',   '--background', 4.5],
    ['success on success-bg',             '--green-700',  '--green-100',  4.5],
    ['warning on warning-bg',             '--amber-700',  '--amber-100',  4.5],
    ['danger on danger-bg',                '--red-700',   '--red-100',    4.5],
    ['neutral on neutral-bg',             '--grey-700',   '--grey-100',   4.5],
    ['primary on mint-soft (badge bg)',   '--cobalt-600', '--cobalt-100', 4.5],
    ['primary on mint-tint (active nav)', '--cobalt-600', '--cobalt-50',  4.5],
    ['notif dot (danger) on surface',     '--red-700',    'WHITE',        3.0],
    ['notif dot (danger) on mint-tint',   '--red-700',    '--cobalt-50',  3.0],
    ['border-input on background',       '--grey-500',   '--background', 3.0],
    ['focus-ring on surface',             '--cobalt-600', 'WHITE',        3.0],
    ['data-fill on data-track',           '--cobalt-600', '--grey-200',   3.0],
  ]

  it.each(cases)('%s meets its required ratio', (_name, fg, bg, min) => {
    const a = fg === 'WHITE' ? '#FFFFFF' : token(fg)
    const b = bg === 'WHITE' ? '#FFFFFF' : token(bg)
    expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(min)
  })

  // border-input on background is the tightest pair in the whole ledger,
  // inherited unchanged from Phase 1's own --grey-500 choice (this file
  // re-measures it against the new --background value; it does not
  // relitigate an already-approved primitive). Pinned explicitly so a
  // future change to either value gets caught even by a margin the it.each
  // loop above would let through.
  it('keeps border-input on background above 3.0 with a real, non-zero margin', () => {
    const ratio = contrastRatio(token('--grey-500'), token('--background'))
    expect(ratio).toBeGreaterThanOrEqual(3.0)
    expect(ratio).toBeLessThan(3.5) // documents how tight this pair actually is
  })
})

describe('glass composite pairs meet contrast against the worst-case glow overlap', () => {
  // .glass / .glass-strong are translucent by design (see the rationale
  // comment on --glass-bg in tokens.css), so the colour a reader actually
  // sees is --glass-bg composited OVER whatever sits behind it - here, the
  // ambient page glow at its strongest point. --glow-cobalt and --glow-sky
  // sit at opposite corners so they do not usually overlap, but compositing
  // both at full strength is the deliberate worst case, not the typical one.
  const backgroundRgba = parseColor(token('--background'))
  const glowCobaltRgba = parseColor(rgbaToken('--glow-cobalt'))
  const glowSkyRgba = parseColor(rgbaToken('--glow-sky'))
  const glassRgba = parseColor(rgbaToken('--glass-bg'))

  const bothGlowsOverBackground = compositeOver(glowSkyRgba, compositeOver(glowCobaltRgba, backgroundRgba))
  const worstCaseGlass = toHex(compositeOver(glassRgba, bothGlowsOverBackground))

  const cases: Array<[string, string, number]> = [
    ['ink on worst-case glass',          '--grey-900',   4.5],
    ['ink-muted on worst-case glass',    '--grey-600',   4.5],
    ['ink-faint on worst-case glass',    '--grey-550',   4.5],
    ['primary on worst-case glass',      '--cobalt-600', 3.0],
    ['border-input on worst-case glass', '--grey-500',   3.0],
  ]

  it.each(cases)('%s meets its required ratio', (_name, fg, min) => {
    expect(contrastRatio(token(fg), worstCaseGlass)).toBeGreaterThanOrEqual(min)
  })
})

describe('dark theme is retired (Kaca Putih is white-only)', () => {
  it('declares color-scheme: light, so native controls never flip dark', () => {
    expect(css).toMatch(/color-scheme:\s*light/)
  })

  it('carries no prefers-color-scheme or data-theme dark block', () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/)
    expect(css).not.toMatch(/data-theme=["']dark["']/)
  })
})

describe('glass surfaces degrade safely without backdrop-filter support', () => {
  it('has an @supports fallback that flattens .glass to a solid surface', () => {
    const fallback = css.match(/@supports not[^{]*\{[\s\S]*?\.glass[\s\S]*?\}\s*\}/)
    expect(fallback, 'no @supports fallback block found for .glass').not.toBeNull()
    expect(fallback![0]).toMatch(/background:\s*var\(--surface\)/)
  })
})

describe('focus ring is actually applied (MASTER.md section 11)', () => {
  const focusRule = css.match(/:focus-visible\s*\{[^}]*\}/)

  it('defines a :focus-visible rule', () => {
    expect(focusRule).not.toBeNull()
  })

  it('draws that rule with the measured --focus-ring token, not a hardcoded colour', () => {
    expect(focusRule?.[0]).toContain('var(--focus-ring)')
  })

  it('offsets the outline so it is not swallowed by the control it surrounds', () => {
    expect(focusRule?.[0]).toMatch(/outline-offset:\s*\d/)
  })
})

describe('reduced motion is honored (MASTER.md section 11)', () => {
  const marker = '@media (prefers-reduced-motion: reduce)'
  const block = css.slice(css.indexOf(marker))

  it('has a prefers-reduced-motion block', () => {
    expect(css).toContain(marker)
  })

  it('collapses the duration tokens so anything built on them stops moving', () => {
    for (const name of ['--dur-instant', '--dur-quick', '--dur-panel']) {
      expect(block).toContain(name)
    }
  })

  it('also neutralises transitions and animations that never read a token', () => {
    expect(block).toMatch(/transition-duration:\s*1ms\s*!important/)
    expect(block).toMatch(/animation-duration:\s*1ms\s*!important/)
  })
})

describe('page shell consumes its own tokens and paints the ambient glow (MASTER.md section 7)', () => {
  // This is the direct regression test for the 2026-09-21 bug: every
  // component consumed its design tokens correctly, but nothing applied them
  // to the document itself, so the page rendered near-white ink on a
  // browser-default white background. A jsdom suite never paints, so only a
  // screenshot caught it originally; this pins the source text so it cannot
  // silently regress again.
  it('html and body set both background-color and colour from tokens', () => {
    const html = css.match(/html\s*\{[^}]*\}/)?.[0] ?? ''
    const body = css.match(/body\s*\{[^}]*\}/)?.[0] ?? ''
    expect(html, 'no html rule in tokens.css').not.toBe('')
    expect(body, 'no body rule in tokens.css').not.toBe('')
    expect(html).toMatch(/background-color:\s*var\(--background\)/)
    expect(html).toMatch(/color:\s*var\(--ink\)/)
    expect(body).toMatch(/background-color:\s*var\(--background\)/)
    expect(body).toMatch(/color:\s*var\(--ink\)/)
  })

  it('paints the ambient glow layers behind the content on both html and body', () => {
    const html = css.match(/html\s*\{[^}]*\}/)?.[0] ?? ''
    const body = css.match(/body\s*\{[^}]*\}/)?.[0] ?? ''
    for (const rule of [html, body]) {
      expect(rule).toMatch(/var\(--glow-cobalt\)/)
      expect(rule).toMatch(/var\(--glow-sky\)/)
    }
  })

  it('loads the self-hosted variable font ahead of the system fallback', () => {
    const body = css.match(/body\s*\{[^}]*\}/)?.[0] ?? ''
    expect(body).toMatch(/font-family:\s*'Plus Jakarta Sans Variable'/)
  })
})
