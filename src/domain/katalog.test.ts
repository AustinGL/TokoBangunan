import { describe, it, expect } from 'vitest'
import { groupUkuranByBarang, normalizeUkuran, findNearDuplicate } from './katalog'
import type { Item } from './projections/items'
import type { Barang } from './projections/barang'

const item = (overrides: Partial<Item> & Pick<Item, 'id' | 'nama' | 'baseUnit'>): Item => ({
  units: [{ unit: overrides.baseUnit, factor: 1 }],
  hargaEceran: 65000,
  stokMinimum: 10,
  diarsipkan: false,
  updatedAt: '2026-09-18T07:00:00.000Z',
  updatedByEventId: 'evt-1',
  ...overrides,
})

const barang = (overrides: Partial<Barang> & Pick<Barang, 'id' | 'nama'>): Barang => ({
  diarsipkan: false,
  updatedAt: '2026-09-18T07:00:00.000Z',
  updatedByEventId: 'evt-0',
  ...overrides,
})

describe('groupUkuranByBarang', () => {
  it('groups two ukuran under their shared barang', () => {
    const semen50 = item({ id: 'u1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', barangId: 'b1' })
    const semen40 = item({ id: 'u2', nama: 'Semen Tiga Roda', baseUnit: '40 kg', barangId: 'b1' })
    const barangById = { b1: barang({ id: 'b1', nama: 'Semen Tiga Roda', kategori: 'Semen' }) }

    const groups = groupUkuranByBarang([semen50, semen40], barangById)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ barangId: 'b1', nama: 'Semen Tiga Roda', kategori: 'Semen' })
    expect(groups[0].ukuran.map(u => u.id).sort()).toEqual(['u1', 'u2'])
  })

  it('gives a legacy item with no barangId its own virtual barang, keyed item-<itemId>', () => {
    const legacy = item({ id: 'legacy-1', nama: 'Paku 5cm', baseUnit: 'kg' })

    const groups = groupUkuranByBarang([legacy], {})

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ barangId: 'item-legacy-1', nama: 'Paku 5cm' })
    expect(groups[0].ukuran).toEqual([legacy])
  })

  it('keeps two different barang as two separate groups', () => {
    const semen = item({ id: 'u1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', barangId: 'b1' })
    const pasir = item({ id: 'u2', nama: 'Pasir', baseUnit: 'm3', barangId: 'b2' })
    const barangById = {
      b1: barang({ id: 'b1', nama: 'Semen Tiga Roda' }),
      b2: barang({ id: 'b2', nama: 'Pasir' }),
    }

    expect(groupUkuranByBarang([semen, pasir], barangById)).toHaveLength(2)
  })
})

describe('normalizeUkuran', () => {
  it('lowercases and trims', () => {
    expect(normalizeUkuran('  50 KG  ')).toBe('50 kg')
  })

  it('collapses internal repeated whitespace', () => {
    expect(normalizeUkuran('50   kg')).toBe('50 kg')
  })
})

describe('findNearDuplicate', () => {
  it('finds an existing ukuran that normalizes the same as the candidate', () => {
    expect(findNearDuplicate('50 KG', ['40 kg', '50 kg'])).toBe('50 kg')
  })

  it('finds a match even when the candidate omits the space entirely', () => {
    // The most common near-duplicate a shop owner actually types.
    expect(findNearDuplicate('50KG', ['50 kg'])).toBe('50 kg')
  })

  it('returns undefined when nothing matches', () => {
    expect(findNearDuplicate('60 kg', ['40 kg', '50 kg'])).toBeUndefined()
  })
})
