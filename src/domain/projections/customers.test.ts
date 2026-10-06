import { describe, it, expect } from 'vitest'
import { projectCustomers } from './customers'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectCustomers', () => {
  it('starts empty', () => {
    expect(projectCustomers([])).toEqual({})
  })

  it('creates a row with the default tier and 30-day terms', () => {
    const e = createEvent('CustomerUpserted', { id: 'c1', nama: 'Budi' }, at('2026-10-01T07:00:00.000Z'))
    expect(projectCustomers([e]).c1).toMatchObject({
      id: 'c1', nama: 'Budi', tier: 'eceran', termynHari: 30,
      updatedAt: '2026-10-01T07:00:00.000Z', updatedByEventId: e.id,
    })
  })

  it('keeps telepon, alamat and custom terms', () => {
    const e = createEvent('CustomerUpserted', { id: 'c1', nama: 'Budi', telepon: '0812', alamat: 'Jl. Mawar', termynHari: 14 }, at('2026-10-01T07:00:00.000Z'))
    expect(projectCustomers([e]).c1).toMatchObject({ telepon: '0812', alamat: 'Jl. Mawar', termynHari: 14 })
  })

  it('last write wins by recordedAt, whatever the fold order', () => {
    const older = createEvent('CustomerUpserted', { id: 'c1', nama: 'Budi' }, at('2026-10-01T07:00:00.000Z'))
    const newer = createEvent('CustomerUpserted', { id: 'c1', nama: 'Budi Santoso' }, at('2026-10-01T08:00:00.000Z'))
    expect(projectCustomers([older, newer]).c1.nama).toBe('Budi Santoso')
    expect(projectCustomers([newer, older]).c1.nama).toBe('Budi Santoso')
  })

  it('ignores other event types', () => {
    const e = createEvent('SupplierUpserted', { id: 's1', nama: 'CV Maju' }, at('2026-10-01T07:00:00.000Z'))
    expect(projectCustomers([e])).toEqual({})
  })
})
