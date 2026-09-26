import { describe, it, expect } from 'vitest'
import { projectSuppliers } from './suppliers'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const base = { id: 'sup-1', nama: 'CV Maju' }
const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectSuppliers', () => {
  it('starts empty', () => {
    expect(projectSuppliers([])).toEqual({})
  })

  it('adds a supplier, defaulting perluDilengkapi to false', () => {
    const state = projectSuppliers([createEvent('SupplierUpserted', base, at('2026-09-18T07:00:00.000Z'))])
    expect(state['sup-1']).toMatchObject({ nama: 'CV Maju', perluDilengkapi: false })
  })

  it('carries a quick-added supplier’s perluDilengkapi through', () => {
    const state = projectSuppliers([
      createEvent('SupplierUpserted', { ...base, perluDilengkapi: true }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state['sup-1'].perluDilengkapi).toBe(true)
  })

  it('a later full-form save clears perluDilengkapi', () => {
    const state = projectSuppliers([
      createEvent('SupplierUpserted', { ...base, perluDilengkapi: true }, at('2026-09-18T07:00:00.000Z')),
      createEvent('SupplierUpserted', { ...base, telepon: '0812', perluDilengkapi: false }, at('2026-09-18T09:00:00.000Z')),
    ])
    expect(state['sup-1']).toMatchObject({ telepon: '0812', perluDilengkapi: false })
  })

  it('breaks a tie on identical recordedAt by event id, independent of fold order', () => {
    const first = createEvent('SupplierUpserted', { ...base, telepon: 'A' }, at('2026-09-18T07:00:00.000Z'))
    const second = createEvent('SupplierUpserted', { ...base, telepon: 'B' }, at('2026-09-18T07:00:00.000Z'))
    expect(second.id > first.id).toBe(true)

    const forward = projectSuppliers([first, second])
    const reversed = projectSuppliers([second, first])

    expect(forward).toEqual(reversed)
    expect(forward['sup-1'].telepon).toBe('B')
  })

  it('ignores event types it does not handle', () => {
    const state = projectSuppliers([
      createEvent('BarangUpserted', { id: 'b1', nama: 'Semen' }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state).toEqual({})
  })
})
