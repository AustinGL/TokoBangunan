// @vitest-environment node
// Regression test for fix round 1 of Task 2.
//
// tailwind.config.js's theme.extend (colors, radii, shadows, timing,
// z-index, font family, tap sizing) is a legacy JS config. Tailwind v4's
// CSS-first engine only loads a JS config when src/index.css has an explicit
// `@config "..."` at-rule; without it, theme.extend is silently inert and
// every token-backed utility class (bg-primary, text-ink-muted, rounded-card,
// ...) fails to resolve, even though the build succeeds with no error.
//
// This test compiles the project's real src/index.css through the same
// @tailwindcss/postcss pipeline the production build uses and asserts that a
// representative set of theme.extend-backed utilities actually emit CSS
// rules. If the @config directive is ever removed, or tailwind.config.js's
// theme.extend is ever broken, this test fails instead of shipping a design
// system that silently does nothing.
//
// @source inline(...) hands Tailwind's v4 candidate scanner a fixed
// classname list, so this test does not depend on any component in the app
// currently rendering these classes.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import tailwindPostcss from '@tailwindcss/postcss'

describe('Tailwind config wiring (tailwind.config.js theme.extend reaches the build)', () => {
  it('compiles token-backed utility classes from theme.extend', async () => {
    const cssUrl = new URL('../index.css', import.meta.url)
    const cssPath = fileURLToPath(cssUrl)
    const source = readFileSync(cssUrl, 'utf8')

    const probeClasses = ['bg-primary', 'text-ink-muted', 'rounded-card', 'min-h-tap', 'z-nav']
    const probeSource = `${source}\n@source inline("${probeClasses.join(' ')}");\n`

    const result = await postcss([tailwindPostcss()]).process(probeSource, { from: cssPath })

    for (const className of probeClasses) {
      const selectorPattern = new RegExp(`\\.${className}\\s*\\{`)
      expect(result.css, `expected a .${className} rule in compiled CSS`).toMatch(selectorPattern)
    }
  })
})
