// @vitest-environment node
/// <reference types="node" />
// Enforces the control system: one height token, no hand-written tap sizes,
// no numeric icon sizes. Every source file must be clean.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('..', import.meta.url))

/** Only these may spell the tap-size classes: they own the 44px hit area. */
const TAP_OWNERS = ['ui/Button.tsx', 'ui/IconButton.tsx']
/** Only the Icon wrapper may hand a number to a lucide component. */
const ICON_OWNER = 'ui/Icon.tsx'

const RAW_SIZE_RULES: Array<[string, RegExp]> = [
  // [h] keeps this file from matching its own grep for the retired tokens.
  ['retired field/button height token (use --control-h)', /--field-[h]|--btn-min-[h]/],
  ['h-11 (one-off control height)', /\bh-11\b/],
  ['min-h-[52px] (one-off control height)', /min-h-\[52px\]/],
]
const TAP_RULE = /\bmin-(?:h|w)-tap\b/

function listSource(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return listSource(full)
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return []
    return [relative(SRC, full).split(sep).join('/')]
  })
}

function lucideNames(text: string): string[] {
  const names: string[] = []
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) {
    for (const part of m[1].split(',')) {
      const local = part.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, '').trim()
      if (local) names.push(local)
    }
  }
  return names
}

export function violations(file: string): string[] {
  const text = readFileSync(join(SRC, file), 'utf8')
  const found: string[] = []
  for (const [label, re] of RAW_SIZE_RULES) if (re.test(text)) found.push(label)
  if (!TAP_OWNERS.includes(file) && TAP_RULE.test(text)) found.push('min-h-tap / min-w-tap outside Button/IconButton')
  if (file !== ICON_OWNER) {
    // `Icon` is included because callers alias `const Icon = item.icon`.
    const tags = new Set([...lucideNames(text), 'Icon'])
    for (const tag of tags) {
      if (new RegExp(`<${tag}\\b[^>]*\\bsize=\\{`).test(text)) { found.push(`numeric size on <${tag}> (use <Icon size="...">)`); break }
    }
  }
  return found
}

describe('control system guard', () => {
  it('every source file is clean', () => {
    const dirty = listSource(SRC).map(f => [f, violations(f)] as const).filter(([, v]) => v.length > 0)
    expect(dirty, 'fix these files: they break the control system').toEqual([])
  })
})
