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

  it('still applies the later write when recordedAt differs (non-tie case unaffected)', () => {
    const forward = projectItems([
      createEvent('ItemUpserted', base, at('2026-09-18T07:00:00.000Z')),
      createEvent('ItemUpserted', { ...base, hargaEceran: 54000 }, at('2026-09-18T09:00:00.000Z')),
    ])
    expect(forward['semen'].hargaEceran).toBe(54000)

    const reversed = projectItems([
      createEvent('ItemUpserted', { ...base, hargaEceran: 54000 }, at('2026-09-18T09:00:00.000Z')),
      createEvent('ItemUpserted', base, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(reversed['semen'].hargaEceran).toBe(54000)
  })

  it('breaks a tie on identical recordedAt by event id, independent of fold order', () => {
    // Two writes stamped with the exact same recordedAt (coarse clock
    // resolution, or two events minted in the same tick). `second` is
    // created after `first`, so its UUIDv7 id sorts strictly greater.
    const first = createEvent('ItemUpserted', { ...base, hargaEceran: 52000 }, at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('ItemUpserted', { ...base, hargaEceran: 54000 }, at('2026-09-18T07:00:00.000Z'))
    expect(second.id > first.id).toBe(true)

    const forward = projectItems([first, second])
    const reversed = projectItems([second, first])

    // The outcome must not depend on which order the events are folded in.
    expect(forward).toEqual(reversed)
    // The event with the greater id (the one minted later) wins the tie.
    expect(forward['semen'].hargaEceran).toBe(54000)
    expect(reversed['semen'].hargaEceran).toBe(54000)
  })
})

describe('projectItems: barangId and diarsipkan', () => {
  it('retains barangId and diarsipkan through the projection', () => {
    const e = createEvent('ItemUpserted', {
      ...base, barangId: 'barang-semen', diarsipkan: true,
    }, at('2026-09-18T07:00:00.000Z'))
    const state = projectItems([e])
    expect(state['semen']).toMatchObject({ barangId: 'barang-semen', diarsipkan: true })
  })
})
