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

/** A token name, the literal WHITE, or a literal hex (for a composited translucent fill). */
function hex(value: string): string {
  if (value === 'WHITE') return '#FFFFFF'
  if (value.startsWith('#')) return value
  return token(value)
}

function token(name: string): string {
  const m = css.match(new RegExp(`${name}\\s*:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token ${name} not found in tokens.css`)
  return m[1]
}

describe('contrast ledger (Toko Clarity)', () => {
  // Each pair is expressed as the primitives its semantic tokens resolve to
  // in tokens.css (semantic tokens like --ink-muted hold a var(...)
  // reference, not a hex literal, so the token() regex above can't read them
  // directly). 'WHITE' stands for both the literal #FFFFFF and --surface's
  // value, which is itself the literal #FFFFFF (tokens.css's own --surface
  // declaration).
  const cases: Array<[string, string, string, number]> = [
    ['ink-on-primary on primary (CTA)', 'WHITE', '--blue-500', 4.5],
    ['ink-on-primary on primary-hover', 'WHITE', '--blue-600', 4.5],
    ['ink-on-primary on primary-active', 'WHITE', '--blue-700', 4.5],
    ['ink on surface', '--gray-900', 'WHITE', 4.5],
    ['ink on background', '--gray-900', '--gray-50', 4.5],
    ['ink on surface-inset', '--gray-900', '--gray-100', 4.5],
    ['ink-muted on surface', '--gray-600', 'WHITE', 4.5],
    ['ink-muted on background', '--gray-600', '--gray-50', 4.5],
    ['ink-muted on surface-inset', '--gray-600', '--gray-100', 4.5],
    ['ink-faint on surface', '--gray-600', 'WHITE', 4.5],
    ['success on success-bg', '--green-700', '--green-100', 4.5],
    ['warning on warning-bg', '--amber-700', '--amber-100', 4.5],
    ['danger on danger-bg', '--red-700', '--red-100', 4.5],
    ['info on info-bg', '--info-700', '--info-100', 4.5],
    ['neutral on neutral-bg', '--gray-700', '--gray-100', 4.5],
    ['primary-ink on accent-soft (badge bg)', '--blue-600', '--blue-100', 4.5],
    ['primary-ink on accent-tint (selected pill)', '--blue-600', '--blue-50', 4.5],
    ['primary-ink on surface (blue text)', '--blue-600', 'WHITE', 4.5],
    ['primary-ink on background', '--blue-600', '--gray-50', 4.5],
    // The gray secondary button is translucent: these are its fill composited
    // over white and over the canvas (12% of 120,120,128).
    ['secondary button text on its fill over surface', '--blue-700', '#EEEEF0', 4.5],
    ['secondary button text on its fill over background', '--blue-700', '#E6E6E9', 4.5],
    ['ink on secondary fill over background', '--gray-900', '#E6E6E9', 4.5],
    ['focal-fg on focal-bg (ink chip, toast)', 'WHITE', '--gray-900', 4.5],
    ['notif dot (danger) on surface', '--red-700', 'WHITE', 3],
    ['notif dot (danger) on accent-tint', '--red-700', '--blue-50', 3],
    ['border-input on surface', '--gray-500', 'WHITE', 3],
    ['border-input on background', '--gray-500', '--gray-50', 3],
    ['focus-ring on surface', '--blue-500', 'WHITE', 3],
    ['data-fill on data-track', '--blue-500', '--blue-100', 3],
  ]

  it.each(cases)('%s meets its required ratio', (_name, fg, bg, min) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(min)
  })
})

describe('native controls stay consistent with the light shell', () => {
  it('declares color-scheme: light, so native controls never flip dark', () => {
    expect(css).toMatch(/color-scheme:\s*light/)
  })

  it('carries no prefers-color-scheme or data-theme dark block', () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/)
    expect(css).not.toMatch(/data-theme=["']dark["']/)
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

describe('page shell consumes its own tokens (MASTER.md section 7)', () => {
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

  it('keeps translucency to the navigation layer and retires the ambient glows', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).toMatch(/backdrop-filter/)
    expect(code).toMatch(/--glass-/)
    expect(code).not.toMatch(/radial-gradient/)
  })

  it('prefers the platform system font, then the self-hosted Inter Variable, then a fallback', () => {
    const body = css.match(/body\s*\{[^}]*\}/)?.[0] ?? ''
    expect(body).toMatch(/font-family:\s*-apple-system,[^;]*'Inter Variable'[^;]*system-ui/)
  })
})
