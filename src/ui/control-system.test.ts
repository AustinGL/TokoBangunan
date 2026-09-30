// @vitest-environment node
/// <reference types="node" />
// Enforces the control system: one height token, no hand-written tap sizes,
// no numeric icon sizes. PENDING is the migration backlog. A file may be in it
// only while it still breaks a rule, and a clean file must NOT be in it, so
// the list can only shrink. Task 11 of the plan deletes it.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('..', import.meta.url))

const PENDING: string[] = [
  'features/akun/Masuk.tsx', 'features/beranda/Beranda.tsx',
  'features/kamus/BarangSheet.tsx', 'features/kamus/KamusBarang.tsx', 'features/kamus/UkuranSheet.tsx',
  'features/shared/BarangPicker.tsx', 'features/shared/UkuranPicker.tsx',
  'features/stok/AturUkuranSheet.tsx', 'features/stok/KoreksiPembelianSheet.tsx', 'features/stok/TambahStokSheet.tsx',
  'features/supplier/Supplier.tsx', 'features/supplier/SupplierSheet.tsx',
  'features/transaksi/SaleDetail.tsx', 'features/transaksi/SaleList.tsx', 'features/transaksi/TanggalFilter.tsx',
]

/** Only these may spell the tap-size classes: they own the 44px hit area. */
const TAP_OWNERS = ['ui/Button.tsx', 'ui/IconButton.tsx']
/** Only the Icon wrapper may hand a number to a lucide component. */
const ICON_OWNER = 'ui/Icon.tsx'

const RAW_SIZE_RULES: Array<[string, RegExp]> = [
  ['--field-h / --btn-min-h token', /--field-h|--btn-min-h/],
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
  const files = listSource(SRC)

  it('PENDING only names files that exist', () => {
    for (const f of PENDING) expect(files, `${f} is in PENDING but does not exist`).toContain(f)
  })

  it('every file outside PENDING is clean', () => {
    const dirty = files.filter(f => !PENDING.includes(f)).map(f => [f, violations(f)] as const).filter(([, v]) => v.length > 0)
    expect(dirty, 'migrate these files, or they are new violations').toEqual([])
  })

  it('every file inside PENDING still has a violation (delete it from PENDING once migrated)', () => {
    const clean = PENDING.filter(f => violations(f).length === 0)
    expect(clean, 'these are already clean: remove them from PENDING').toEqual([])
  })
})
