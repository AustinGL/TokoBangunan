import { describe, it, expect } from 'vitest'
import { projectPayments } from './payments'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectPayments', () => {
  it('starts empty', () => {
    expect(projectPayments([])).toEqual({})
  })

  it('creates a row keyed by the event id, with the envelope times and device', () => {
    const e = createEvent('PaymentReceived', { saleId: 's1', jumlah: 50000, catatan: 'cicilan' }, at('2026-10-05T09:00:00.000Z'))
    expect(projectPayments([e])[e.id]).toEqual({
      id: e.id, saleId: 's1', jumlah: 50000, catatan: 'cicilan',
      occurredAt: '2026-10-05T09:00:00.000Z', recordedAt: '2026-10-05T09:00:00.000Z', deviceId: 'laptop',
    })
  })

  it('is idempotent: replaying the same event changes nothing', () => {
    const e = createEvent('PaymentReceived', { saleId: 's1', jumlah: 50000 }, at('2026-10-05T09:00:00.000Z'))
    expect(projectPayments([e, e])).toEqual(projectPayments([e]))
  })

  it('keeps two payments on the same sale as two rows', () => {
    const a = createEvent('PaymentReceived', { saleId: 's1', jumlah: 10000 }, at('2026-10-05T09:00:00.000Z'))
    const b = createEvent('PaymentReceived', { saleId: 's1', jumlah: 20000 }, at('2026-10-06T09:00:00.000Z'))
    expect(Object.keys(projectPayments([a, b]))).toHaveLength(2)
  })

  it('ignores other event types', () => {
    const e = createEvent('SupplierUpserted', { id: 's1', nama: 'CV Maju' }, at('2026-10-05T09:00:00.000Z'))
    expect(projectPayments([e])).toEqual({})
  })
})
