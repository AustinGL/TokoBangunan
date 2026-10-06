import { describe, it, expect } from 'vitest'
import { projectToko } from './toko'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectToko', () => {
  it('starts empty', () => {
    expect(projectToko([])).toEqual({})
  })

  it('creates the single shop row', () => {
    const e = createEvent('TokoDiatur', { nama: 'Toko Maju' }, at('2026-10-05T07:00:00.000Z'))
    expect(projectToko([e]).toko).toEqual({ id: 'toko', nama: 'Toko Maju', updatedAt: '2026-10-05T07:00:00.000Z', updatedByEventId: e.id })
  })

  it('last write wins by recordedAt, whatever the fold order', () => {
    const older = createEvent('TokoDiatur', { nama: 'Toko Lama' }, at('2026-10-05T07:00:00.000Z'))
    const newer = createEvent('TokoDiatur', { nama: 'Toko Baru' }, at('2026-10-05T08:00:00.000Z'))
    expect(projectToko([older, newer]).toko.nama).toBe('Toko Baru')
    expect(projectToko([newer, older]).toko.nama).toBe('Toko Baru')
  })

  it('an empty name clears it (the row stays, with an empty name)', () => {
    const set = createEvent('TokoDiatur', { nama: 'Toko Maju' }, at('2026-10-05T07:00:00.000Z'))
    const clear = createEvent('TokoDiatur', { nama: '' }, at('2026-10-05T08:00:00.000Z'))
    expect(projectToko([set, clear]).toko.nama).toBe('')
  })

  it('ignores other event types', () => {
    const e = createEvent('SupplierUpserted', { id: 's1', nama: 'CV Maju' }, at('2026-10-05T07:00:00.000Z'))
    expect(projectToko([e])).toEqual({})
  })
})
