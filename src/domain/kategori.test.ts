import { describe, it, expect } from 'vitest'
import { normalizeKategoriName, kategoriIdForName, effectiveKategoriId, buildKategoriList, resolveKategori } from './kategori'
import type { Kategori } from './projections/kategori'

const row = (id: string, nama: string, diarsipkan = false): Kategori =>
  ({ id, nama, diarsipkan, updatedAt: '2026-09-30T00:00:00.000Z', updatedByEventId: 'e' })

describe('kategori names and ids', () => {
  it('normalizes case, surrounding space and inner runs of space', () => {
    expect(normalizeKategoriName('  Semen  Tiga   Roda ')).toBe('semen tiga roda')
  })
  it('derives one id for every spelling of a name', () => {
    expect(kategoriIdForName('Semen')).toBe(kategoriIdForName(' semen '))
    expect(kategoriIdForName('SEMEN')).toBe(kategoriIdForName('semen'))
  })
  it('derives different ids for different names, including ones a slug would merge', () => {
    expect(kategoriIdForName('a b')).not.toBe(kategoriIdForName('a-b'))
  })
  it('an id survives characters that are awkward in keys', () => {
    expect(kategoriIdForName('Cat & Pelapis / 5%')).toMatch(/^kat_[A-Za-z0-9%._~*'()!-]+$/)
  })
})

describe('effectiveKategoriId', () => {
  it('prefers an explicit kategoriId', () => {
    expect(effectiveKategoriId({ kategoriId: 'kat_x', kategori: 'Semen' })).toBe('kat_x')
  })
  it('derives an id from legacy text', () => {
    expect(effectiveKategoriId({ kategori: ' Semen ' })).toBe(kategoriIdForName('Semen'))
  })
  it('is undefined for blank or missing text', () => {
    expect(effectiveKategoriId({})).toBeUndefined()
    expect(effectiveKategoriId({ kategori: '   ' })).toBeUndefined()
  })
})

describe('buildKategoriList', () => {
  it('lists master rows as materialized', () => {
    expect(buildKategoriList([row('kat_a', 'Alat')], [])).toEqual([{ id: 'kat_a', nama: 'Alat', diarsipkan: false, materialized: true }])
  })
  it('surfaces legacy text as ONE unmaterialized entry however it is spelled', () => {
    const list = buildKategoriList([], [{ kategori: 'Semen' }, { kategori: 'semen ' }, { kategori: 'SEMEN' }])
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ nama: 'Semen', materialized: false, diarsipkan: false })
  })
  it('does not duplicate a legacy name that already has a master row', () => {
    const list = buildKategoriList([row(kategoriIdForName('Semen'), 'Semen')], [{ kategori: 'semen' }])
    expect(list).toHaveLength(1)
    expect(list[0].materialized).toBe(true)
  })
  it('ignores sources that already carry a kategoriId', () => {
    expect(buildKategoriList([], [{ kategoriId: 'kat_gone', kategori: 'Lama' }])).toEqual([])
  })
  it('keeps an archived master row, flagged', () => {
    expect(buildKategoriList([row('kat_a', 'Alat', true)], [])[0].diarsipkan).toBe(true)
  })
  it('sorts by name, case-insensitively', () => {
    const list = buildKategoriList([row('kat_b', 'besi'), row('kat_a', 'Alat')], [{ kategori: 'Cat' }])
    expect(list.map(e => e.nama)).toEqual(['Alat', 'besi', 'Cat'])
  })
})

describe('resolveKategori', () => {
  const byId = new Map(buildKategoriList([row('kat_a', 'Alat Baru')], [{ kategori: 'Semen' }]).map(e => [e.id, e]))
  it('resolves an id to the master name (a rename reaches every barang)', () => {
    expect(resolveKategori({ kategoriId: 'kat_a' }, byId)).toEqual({ id: 'kat_a', nama: 'Alat Baru' })
  })
  it('resolves legacy text through the list, so a rename of the derived entry applies too', () => {
    const renamed = new Map([[kategoriIdForName('Semen'), { id: kategoriIdForName('Semen'), nama: 'Semen Tiga Roda', diarsipkan: false, materialized: true }]])
    expect(resolveKategori({ kategori: 'Semen' }, renamed)).toEqual({ id: kategoriIdForName('Semen'), nama: 'Semen Tiga Roda' })
  })
  it('falls back to the legacy text when no entry is known', () => {
    expect(resolveKategori({ kategori: ' Cat ' }, new Map())).toEqual({ id: kategoriIdForName('Cat'), nama: 'Cat' })
  })
  it('gives no name for an id with no master row (never invents one)', () => {
    expect(resolveKategori({ kategoriId: 'kat_missing' }, new Map())).toEqual({ id: 'kat_missing', nama: undefined })
  })
  it('gives nothing for a barang with no kategori', () => {
    expect(resolveKategori({}, byId)).toEqual({ id: undefined, nama: undefined })
  })
})
