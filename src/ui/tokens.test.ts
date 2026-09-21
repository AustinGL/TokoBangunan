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
import { contrastRatio } from './contrast'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

function token(name: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token ${name} not found in tokens.css`)
  return m[1]
}

describe('contrast ledger (MASTER.md section 3)', () => {
  // Light theme, 16 pairs (MASTER.md:369-386). Each pair is expressed as the
  // primitives its semantic tokens resolve to in the :root block of
  // tokens.css (semantic tokens like --ink-muted hold a var(...) reference,
  // not a hex literal, so the token() regex above can't read them directly).
  // 'WHITE' stands for both literal #FFFFFF and --surface's light value,
  // which is itself the literal #FFFFFF (tokens.css line 37).
  const lightCases: Array<[string, string, string, number]> = [
    ['ink-on-primary on primary (CTA)',   'WHITE',      '--mint-600', 4.5],
    ['ink-on-primary on primary-hover',   'WHITE',      '--mint-700', 4.5],
    ['white on secondary',                'WHITE',      '--lav-600',  4.5],
    ['ink on surface',                    '--grey-900', 'WHITE',      4.5],
    ['ink-muted on background',           '--grey-600', '--grey-50',  4.5],
    ['ink-faint on surface',              '--grey-550', 'WHITE',      4.5],
    ['ink-faint on background',           '--grey-550', '--grey-50',  4.5],
    ['success on success-bg',             '--green-700','--mint-100', 4.5],
    ['success on mint-tint (active nav)', '--green-700','--mint-50',  4.5],
    ['warning on warning-bg',             '--amber-700','--amber-100',4.5],
    ['danger on danger-bg',               '--red-700',  '--red-100',  4.5],
    ['neutral on neutral-bg',             '--grey-700', '--grey-100', 4.5],
    ['secondary on lavender-soft',        '--lav-600',  '--lav-50',   4.5],
    ['border-input on background',        '--grey-500', '--grey-50',  3.0],
    ['focus-ring on surface',             '--mint-600', 'WHITE',      3.0],
    ['data-fill on data-track',           '--mint-600', '--grey-200', 3.0],
  ]

  // Dark theme, 11 pairs (MASTER.md:388-402). Resolved the same way, against
  // the primitives the dark [data-theme="dark"] block in tokens.css maps
  // each dark semantic token to (identical to the prefers-color-scheme
  // block). Every ratio below was independently recomputed with
  // contrastRatio() against these primitives and matches MASTER.md's stated
  // ratio to within 0.01, confirming the mapping (not just trusted from the
  // brief).
  const darkCases: Array<[string, string, string, number]> = [
    ['dark ink-on-primary on primary (CTA)', '--mint-900', '--mint-400', 4.5],
    ['dark ink on surface',                  '--slate-100','--slate-850',4.5],
    ['dark ink-muted on surface',            '--slate-300','--slate-850',4.5],
    ['dark ink-faint on surface',            '--slate-400','--slate-850',4.5],
    ['dark success on success-bg',           '--green-300','--green-950',4.5],
    ['dark warning on warning-bg',           '--amber-300','--amber-950',4.5],
    ['dark danger on danger-bg',             '--red-300',  '--red-950',  4.5],
    ['dark secondary on surface',            '--lav-300',  '--slate-850',4.5],
    ['dark border-input on surface',         '--slate-500','--slate-850',3.0],
    ['dark focus-ring on surface',           '--mint-400', '--slate-850',3.0],
    ['dark data-fill on data-track',         '--mint-400', '--slate-700',3.0],
  ]

  const cases = [...lightCases, ...darkCases]

  it.each(cases)('%s meets AA', (_name, fg, bg, min) => {
    const a = fg === 'WHITE' ? '#FFFFFF' : token(fg)
    const b = bg === 'WHITE' ? '#FFFFFF' : token(bg)
    expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(min)
  })
})

describe('focus ring is actually applied (MASTER.md section 11)', () => {
  // --focus-ring is defined in all three theme blocks and its contrast is
  // asserted above in both themes, but a token nothing references is a token
  // that does nothing: the measurement was real and the ring on screen was
  // still the browser default, which is least reliable exactly where this app
  // puts mint on mint. This pins the rule that spends the token.
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

describe('page shell consumes its own tokens (MASTER.md section 7)', () => {
  // This is the assertion that was missing when the app rendered near-white
  // --ink on a browser-default white page: every component consumed the tokens
  // correctly, but nothing applied them to the document itself. A jsdom suite
  // never paints, so only a screenshot caught it. This pins it.
  it('html and body set both background and colour from tokens', () => {
    const html = css.match(/html\s*\{[^}]*\}/)?.[0] ?? ''
    const body = css.match(/body\s*\{[^}]*\}/)?.[0] ?? ''
    expect(html, 'no html rule in tokens.css').not.toBe('')
    expect(body, 'no body rule in tokens.css').not.toBe('')
    expect(html).toMatch(/background:\s*var\(--background\)/)
    expect(html).toMatch(/color:\s*var\(--ink\)/)
    expect(body).toMatch(/background:\s*var\(--background\)/)
    expect(body).toMatch(/color:\s*var\(--ink\)/)
  })
})
