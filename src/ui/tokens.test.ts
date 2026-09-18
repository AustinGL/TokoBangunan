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
  const cases: Array<[string, string, string, number]> = [
    ['white on primary (CTA)',        '--mint-600', 'WHITE',       4.5],
    ['white on primary-hover',        '--mint-700', 'WHITE',       4.5],
    ['white on secondary',            '--lav-600',  'WHITE',       4.5],
    ['ink-muted on background',       '--grey-600', '--grey-50',   4.5],
    ['ink-faint on background',       '--grey-550', '--grey-50',   4.5],
    ['success on success-bg',         '--green-700','--mint-100',  4.5],
    ['warning on warning-bg',         '--amber-700','--amber-100', 4.5],
    ['danger on danger-bg',           '--red-700',  '--red-100',   4.5],
    ['neutral on neutral-bg',         '--grey-700', '--grey-100',  4.5],
    ['border-input on background',    '--grey-500', '--grey-50',   3.0],
    ['data-fill on data-track',       '--mint-600', '--grey-200',  3.0],
  ]

  it.each(cases)('%s meets AA', (_name, fg, bg, min) => {
    const a = fg === 'WHITE' ? '#FFFFFF' : token(fg)
    const b = bg === 'WHITE' ? '#FFFFFF' : token(bg)
    expect(contrastRatio(a, b)).toBeGreaterThanOrEqual(min)
  })
})
