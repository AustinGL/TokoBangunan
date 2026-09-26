import { describe, it, expect } from 'vitest'
import { projectBarang } from './barang'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const base = { id: 'barang-semen', nama: 'Semen Tiga Roda' }
const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectBarang', () => {
  it('starts empty', () => {
    expect(projectBarang([])).toEqual({})
  })

  it('adds a barang, defaulting diarsipkan to false', () => {
    const state = projectBarang([createEvent('BarangUpserted', base, at('2026-09-18T07:00:00.000Z'))])
    expect(state['barang-semen']).toMatchObject({ nama: 'Semen Tiga Roda', diarsipkan: false })
  })

  it('applies the later write when a barang is renamed', () => {
    const state = projectBarang([
      createEvent('BarangUpserted', base, at('2026-09-18T07:00:00.000Z')),
      createEvent('BarangUpserted', { ...base, nama: 'Semen Tiga Roda 50kg' }, at('2026-09-18T09:00:00.000Z')),
    ])
    expect(state['barang-semen'].nama).toBe('Semen Tiga Roda 50kg')
  })

  it('ignores an out-of-order older write', () => {
    const state = projectBarang([
      createEvent('BarangUpserted', { ...base, kategori: 'Semen' }, at('2026-09-18T09:00:00.000Z')),
      createEvent('BarangUpserted', { ...base, kategori: 'Lama' }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state['barang-semen'].kategori).toBe('Semen')
  })

  it('breaks a tie on identical recordedAt by event id, independent of fold order', () => {
    const first = createEvent('BarangUpserted', { ...base, kategori: 'A' }, at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('BarangUpserted', { ...base, kategori: 'B' }, at('2026-09-18T07:00:00.000Z'))
    expect(second.id > first.id).toBe(true)

    const forward = projectBarang([first, second])
    const reversed = projectBarang([second, first])

    expect(forward).toEqual(reversed)
    expect(forward['barang-semen'].kategori).toBe('B')
  })

  it('ignores event types it does not handle', () => {
    const state = projectBarang([
      createEvent('SupplierUpserted', { id: 's1', nama: 'Toko Besi Jaya' }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state).toEqual({})
  })
})
