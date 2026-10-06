import { describe, it, expect } from 'vitest'
import { projectSales } from './sales'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const line = { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 2000, hargaSatuan: 52000, subtotal: 104000 }

const saleRecorded = (overrides: Partial<{ lines: typeof line[]; total: number }> = {}) => ({
  lines: overrides.lines ?? [line],
  metodeBayar: 'tunai' as const,
  subtotal: 104000,
  diskon: 0,
  total: overrides.total ?? 104000,
  uangDiterima: 110000,
})

const saleVoided = (saleId: string, alasan = 'salah input') => ({ saleId, alasan })

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

describe('projectSales', () => {
  it('starts empty', () => {
    expect(projectSales([])).toEqual({})
  })

  it('creates a row keyed by the event\'s own id, aktif, with envelope fields not payload fields', () => {
    const recorded = createEvent('SaleRecorded', saleRecorded(), at('2026-09-18T07:00:00.000Z'))
    const state = projectSales([recorded])

    expect(state[recorded.id]).toMatchObject({
      id: recorded.id,
      status: 'aktif',
      occurredAt: recorded.occurredAt,
      recordedAt: recorded.recordedAt,
      deviceId: recorded.deviceId,
      total: 104000,
    })
  })

  it('is idempotent: folding the same SaleRecorded twice is a no-op', () => {
    const recorded = createEvent('SaleRecorded', saleRecorded(), at('2026-09-18T07:00:00.000Z'))
    const once = projectSales([recorded])
    const twice = projectSales([recorded, recorded])

    expect(twice).toEqual(once)
  })

  it('SaleVoided patches the referenced SaleRecorded row to batal', () => {
    const recorded = createEvent('SaleRecorded', saleRecorded(), at('2026-09-18T07:00:00.000Z'))
    const voided = createEvent('SaleVoided', saleVoided(recorded.id, 'salah input'), at('2026-09-18T07:05:00.000Z'))

    const state = projectSales([recorded, voided])

    expect(state[recorded.id]).toMatchObject({
      status: 'batal',
      voidedAt: voided.recordedAt,
      voidedReason: 'salah input',
    })
  })

  it('SaleVoided referencing a saleId with no matching row is a safe no-op, not a phantom row', () => {
    const voided = createEvent('SaleVoided', saleVoided('does-not-exist'), at('2026-09-18T07:05:00.000Z'))

    const state = projectSales([voided])

    expect(state).toEqual({})
  })

  it('a second SaleVoided on an already-batal sale is a no-op', () => {
    // A sale can only be voided once in this phase's flow. This guard is
    // what makes a defensive double-fold safe: without it, a replayed or
    // duplicated SaleVoided could overwrite voidedAt/voidedReason with a
    // second void's values, corrupting the audit trail of why/when the sale
    // was actually voided.
    const recorded = createEvent('SaleRecorded', saleRecorded(), at('2026-09-18T07:00:00.000Z'))
    const firstVoid = createEvent('SaleVoided', saleVoided(recorded.id, 'salah input'), at('2026-09-18T07:05:00.000Z'))
    const secondVoid = createEvent('SaleVoided', saleVoided(recorded.id, 'alasan lain'), at('2026-09-18T08:00:00.000Z'))

    const state = projectSales([recorded, firstVoid, secondVoid])

    expect(state[recorded.id]).toMatchObject({
      status: 'batal',
      voidedAt: firstVoid.recordedAt,
      voidedReason: 'salah input',
    })
  })

  it('ignores event types it does not handle', () => {
    const state = projectSales([
      createEvent('ItemUpserted', {
        id: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak',
        units: [{ unit: 'sak', factor: 1 }], hargaEceran: 52000, stokMinimum: 0,
      }, at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: 10, reason: 'initial' as const }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state).toEqual({})
  })

  it('drops a SaleVoided folded before its matching SaleRecorded (documented limitation, not a defect)', () => {
    // Unlike stock.ts, this reducer's correctness DOES depend on
    // SaleRecorded folding before its matching SaleVoided: there is no
    // tie-break to save it if the void is folded first. This is accepted
    // per the plan's own reasoning -- main event replay is always
    // recordedAt-sorted, and no UI in this phase can author a SaleVoided
    // before its SaleRecorded exists. This test characterizes the real
    // behavior at that boundary rather than asserting a fix for it.
    const recorded = createEvent('SaleRecorded', saleRecorded(), at('2026-09-18T07:00:00.000Z'))
    const voided = createEvent('SaleVoided', saleVoided(recorded.id, 'salah input'), at('2026-09-18T07:05:00.000Z'))

    const state = projectSales([voided, recorded])

    expect(state[recorded.id]).toMatchObject({ status: 'aktif' })
    expect(state[recorded.id].voidedAt).toBeUndefined()
  })
})

describe('reduceSales: batchId/hargaNormal passthrough and derived indexes', () => {
  it('retains batchId and hargaNormal on each line', () => {
    const e = createEvent('SaleRecorded', {
      lines: [{ itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000, batchId: 'batch-1', hargaNormal: 65000 }],
      metodeBayar: 'tunai' as const, subtotal: 63000, diskon: 0, total: 63000,
    }, at('2026-09-18T07:00:00.000Z'))
    const state = projectSales([e])
    expect(state[e.id].lines[0]).toMatchObject({ batchId: 'batch-1', hargaNormal: 65000 })
  })

  it('derives itemIds and batchIds, deduplicated, across multiple lines', () => {
    const e = createEvent('SaleRecorded', {
      lines: [
        { itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000, batchId: 'batch-1' },
        { itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 500, hargaSatuan: 63000, subtotal: 31500, batchId: 'batch-1' },
        { itemId: 'pasir', nama: 'Pasir', unit: 'm3', qty: 1000, hargaSatuan: 180000, subtotal: 180000 },
      ],
      metodeBayar: 'tunai' as const, subtotal: 274500, diskon: 0, total: 274500,
    }, at('2026-09-18T07:00:00.000Z'))
    const state = projectSales([e])
    expect(state[e.id].itemIds.sort()).toEqual(['pasir', 'semen'])
    expect(state[e.id].batchIds).toEqual(['batch-1'])
  })

  it('gives an empty batchIds array for a sale with no batch on any line (legacy pool)', () => {
    const e = createEvent('SaleRecorded', {
      lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 63000, subtotal: 63000 }],
      metodeBayar: 'tunai' as const, subtotal: 63000, diskon: 0, total: 63000,
    }, at('2026-09-18T07:00:00.000Z'))
    expect(projectSales([e])[e.id].batchIds).toEqual([])
  })
})

describe('projectSales Bon fields', () => {
  it('keeps metodeBayar, customerId, jatuhTempo and dibayarAwal on a Bon sale', () => {
    const e = createEvent('SaleRecorded', {
      lines: [line], metodeBayar: 'bon' as const, subtotal: 104000, diskon: 0, total: 104000,
      customerId: 'c1', jatuhTempo: '2026-10-17', dibayarAwal: 20000,
    }, at('2026-10-03T07:00:00.000Z'))
    expect(projectSales([e])[e.id]).toMatchObject({
      metodeBayar: 'bon', customerId: 'c1', jatuhTempo: '2026-10-17', dibayarAwal: 20000, status: 'aktif',
    })
  })
})
