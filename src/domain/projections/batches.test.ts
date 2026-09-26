import { describe, it, expect } from 'vitest'
import { projectBatches } from './batches'
import { createEvent } from '../events'
import { fixedClock } from '../clock'

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

const received = (batchId: string, overrides: Partial<{ itemId: string; qty: number; hargaBeli: number; hargaJual: number; supplierId: string }> = {}) => ({
  supplierId: overrides.supplierId ?? 'sup-1',
  lines: [{
    batchId,
    itemId: overrides.itemId ?? 'semen',
    qty: overrides.qty ?? 40000,
    hargaBeli: overrides.hargaBeli ?? 60000,
    hargaJual: overrides.hargaJual ?? 67000,
  }],
})

describe('projectBatches', () => {
  it('starts empty', () => {
    expect(projectBatches([])).toEqual({})
  })

  it('creates a batch row from StockReceived, with diterima and sisa both equal to the received qty', () => {
    const state = projectBatches([createEvent('StockReceived', received('batch-1'), at('2026-09-18T07:00:00.000Z'))])
    expect(state['batch-1']).toMatchObject({
      itemId: 'semen', supplierId: 'sup-1', hargaBeli: 60000, hargaJual: 67000, diterima: 40000, sisa: 40000,
    })
  })

  it('a sale StockAdjusted against the batch reduces sisa but not diterima', () => {
    const state = projectBatches([
      createEvent('StockReceived', received('batch-1'), at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: -3000, reason: 'sale' as const, batchId: 'batch-1' }, at('2026-09-18T08:00:00.000Z')),
    ])
    expect(state['batch-1'].sisa).toBe(37000)
    expect(state['batch-1'].diterima).toBe(40000)
  })

  it('a void StockAdjusted against the batch reverses a sale, restoring sisa', () => {
    const state = projectBatches([
      createEvent('StockReceived', received('batch-1'), at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: -3000, reason: 'sale' as const, batchId: 'batch-1' }, at('2026-09-18T08:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: 3000, reason: 'void' as const, batchId: 'batch-1' }, at('2026-09-18T09:00:00.000Z')),
    ])
    expect(state['batch-1'].sisa).toBe(40000)
  })

  it('a StockAdjusted with no batchId is not folded into any batch row', () => {
    const state = projectBatches([
      createEvent('StockReceived', received('batch-1'), at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: -1000, reason: 'sale' as const }, at('2026-09-18T08:00:00.000Z')),
    ])
    expect(state['batch-1'].sisa).toBe(40000)
  })

  it('drops a StockAdjusted referencing a batchId this device has never received, without crashing', () => {
    const state = projectBatches([
      createEvent('StockAdjusted', { itemId: 'semen', quantity: -1000, reason: 'sale' as const, batchId: 'batch-unknown' }, at('2026-09-18T08:00:00.000Z')),
    ])
    expect(state).toEqual({})
  })

  it('BatchCorrected overwrites metadata (last-write-wins) without touching sisa', () => {
    const state = projectBatches([
      createEvent('StockReceived', received('batch-1'), at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: -3000, reason: 'sale' as const, batchId: 'batch-1' }, at('2026-09-18T08:00:00.000Z')),
      createEvent('BatchCorrected', {
        batchId: 'batch-1', supplierId: 'sup-2', hargaBeli: 58000, hargaJual: 65000, tanggalBeli: '2026-09-15T00:00:00.000Z',
      }, at('2026-09-18T10:00:00.000Z')),
    ])
    expect(state['batch-1']).toMatchObject({ supplierId: 'sup-2', hargaBeli: 58000, hargaJual: 65000 })
    // Metadata-only correction: sisa still reflects the sale that already happened.
    expect(state['batch-1'].sisa).toBe(37000)
  })

  it('BatchCorrected with a jumlah fixes diterima for display without touching sisa, so a typo fix never erases an already-recorded sale', () => {
    // This is the load-bearing case: the owner typed 50 sak, it was really
    // 40. 10 have already been sold (sisa 40). Correcting diterima to 40
    // must leave sisa at 40 - it does NOT retroactively become 30, because
    // the correction is about what the record SAYS was received, not a
    // second sale.
    const state = projectBatches([
      createEvent('StockReceived', received('batch-1', { qty: 50000 }), at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: -10000, reason: 'sale' as const, batchId: 'batch-1' }, at('2026-09-18T08:00:00.000Z')),
      createEvent('BatchCorrected', {
        batchId: 'batch-1', hargaBeli: 60000, hargaJual: 67000, tanggalBeli: '2026-09-15T00:00:00.000Z', jumlah: 40000,
      }, at('2026-09-18T10:00:00.000Z')),
    ])
    expect(state['batch-1'].diterima).toBe(40000)
    expect(state['batch-1'].sisa).toBe(40000)
  })

  it('a companion StockAdjusted(koreksi) alongside a BatchCorrected does change sisa, by its own signed delta', () => {
    const state = projectBatches([
      createEvent('StockReceived', received('batch-1', { qty: 50000 }), at('2026-09-18T07:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: -10000, reason: 'sale' as const, batchId: 'batch-1' }, at('2026-09-18T08:00:00.000Z')),
      createEvent('BatchCorrected', {
        batchId: 'batch-1', hargaBeli: 60000, hargaJual: 67000, tanggalBeli: '2026-09-15T00:00:00.000Z', jumlah: 40000,
      }, at('2026-09-18T10:00:00.000Z')),
      createEvent('StockAdjusted', { itemId: 'semen', quantity: -10000, reason: 'koreksi' as const, batchId: 'batch-1' }, at('2026-09-18T10:00:00.000Z')),
    ])
    expect(state['batch-1'].diterima).toBe(40000)
    expect(state['batch-1'].sisa).toBe(30000)
  })

  it('ignores a BatchCorrected for a batch this device has no record of', () => {
    const state = projectBatches([
      createEvent('BatchCorrected', {
        batchId: 'batch-unknown', hargaBeli: 60000, hargaJual: 67000, tanggalBeli: '2026-09-15T00:00:00.000Z',
      }, at('2026-09-18T10:00:00.000Z')),
    ])
    expect(state).toEqual({})
  })

  it('breaks a metadata tie on identical recordedAt by event id, independent of fold order', () => {
    const receive = createEvent('StockReceived', received('batch-1'), at('2026-09-18T07:00:00.000Z'))
    const first = createEvent('BatchCorrected', { batchId: 'batch-1', hargaJual: 65000, tanggalBeli: '2026-09-15T00:00:00.000Z' }, at('2026-09-18T09:00:00.000Z'))
    const second = createEvent('BatchCorrected', { batchId: 'batch-1', hargaJual: 66000, tanggalBeli: '2026-09-15T00:00:00.000Z' }, at('2026-09-18T09:00:00.000Z'))
    expect(second.id > first.id).toBe(true)

    const forward = projectBatches([receive, first, second])
    const reversed = projectBatches([receive, second, first])

    expect(forward).toEqual(reversed)
    expect(forward['batch-1'].hargaJual).toBe(66000)
  })

  it('ignores event types it does not handle', () => {
    const state = projectBatches([
      createEvent('BarangUpserted', { id: 'b1', nama: 'Semen' }, at('2026-09-18T07:00:00.000Z')),
    ])
    expect(state).toEqual({})
  })
})
