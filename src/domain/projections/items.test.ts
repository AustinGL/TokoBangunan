import { describe, it, expect } from 'vitest'
import { projectItems } from './items'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const base = {
  id: 'semen',
  nama: 'Semen Tiga Roda',
  baseUnit: 'sak',
  units: [{ unit: 'sak', factor: 1 }],
  hargaEceran: 52000,
  stokMinimum: 20000,
}

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectItems', () => {
  it('starts empty', () => {
    expect(projectItems([])).toEqual({})
  })

  it('adds an item', () => {
    const state = projectItems([
      createEvent('ItemUpserted', base, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state['semen'].nama).toBe('Semen Tiga Roda')
    expect(state['semen'].hargaEceran).toBe(52000)
  })

  it('applies the later write when an item is updated', () => {
    const state = projectItems([
      createEvent('ItemUpserted', base, at('2026-09-18T07:00:00.000Z')),
      createEvent('ItemUpserted', { ...base, hargaEceran: 54000 }, at('2026-09-18T09:00:00.000Z')),
    ])
    expect(state['semen'].hargaEceran).toBe(54000)
  })

  it('ignores an out-of-order older write', () => {
    const state = projectItems([
      createEvent('ItemUpserted', { ...base, hargaEceran: 54000 }, at('2026-09-18T09:00:00.000Z')),
      createEvent('ItemUpserted', { ...base, hargaEceran: 52000 }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state['semen'].hargaEceran).toBe(54000)
  })

  it('ignores event types it does not handle', () => {
    const state = projectItems([
      createEvent('SupplierUpserted', { id: 's1', nama: 'Toko Besi Jaya' }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state).toEqual({})
  })
})
