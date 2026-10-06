import { describe, it, expect } from 'vitest'
import { projectExpenses } from './expenses'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectExpenses', () => {
  it('starts empty', () => {
    expect(projectExpenses([])).toEqual({})
  })

  it('creates an active row keyed by the event id, with the envelope times and device', () => {
    const e = createEvent('ExpenseRecorded', { jumlah: 1_500_000, kategori: 'gaji', catatan: 'Agus' }, at('2026-10-05T09:00:00.000Z'))
    expect(projectExpenses([e])[e.id]).toEqual({
      id: e.id, jumlah: 1_500_000, kategori: 'gaji', catatan: 'Agus', status: 'aktif',
      occurredAt: '2026-10-05T09:00:00.000Z', recordedAt: '2026-10-05T09:00:00.000Z', deviceId: 'laptop',
    })
  })

  it('is idempotent: replaying the same event changes nothing', () => {
    const e = createEvent('ExpenseRecorded', { jumlah: 100, kategori: 'sewa' }, at('2026-10-05T09:00:00.000Z'))
    expect(projectExpenses([e, e])).toEqual(projectExpenses([e]))
  })

  it('marks an expense batal when a void names it, and keeps the row', () => {
    const e = createEvent('ExpenseRecorded', { jumlah: 100, kategori: 'sewa' }, at('2026-10-05T09:00:00.000Z'))
    const v = createEvent('ExpenseVoided', { expenseId: e.id }, at('2026-10-06T09:00:00.000Z'))
    expect(projectExpenses([e, v])[e.id]).toMatchObject({ status: 'batal', voidedAt: '2026-10-06T09:00:00.000Z' })
  })

  it('ignores a void for an unknown expense and a second void of the same one', () => {
    const e = createEvent('ExpenseRecorded', { jumlah: 100, kategori: 'sewa' }, at('2026-10-05T09:00:00.000Z'))
    const stray = createEvent('ExpenseVoided', { expenseId: 'nope' }, at('2026-10-05T10:00:00.000Z'))
    const v1 = createEvent('ExpenseVoided', { expenseId: e.id }, at('2026-10-06T09:00:00.000Z'))
    const v2 = createEvent('ExpenseVoided', { expenseId: e.id }, at('2026-10-07T09:00:00.000Z'))
    const state = projectExpenses([e, stray, v1, v2])
    expect(Object.keys(state)).toEqual([e.id])
    expect(state[e.id].voidedAt).toBe('2026-10-06T09:00:00.000Z')
  })
})
