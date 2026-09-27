import { describe, it, expect } from 'vitest'
import { legacyRemainder, availableForLine, pickDefaultBatch, planSplit } from './batchPick'

const batch = (batchId: string, itemId: string, sisa: number, tanggalBeli: string) => ({ batchId, itemId, sisa, tanggalBeli })

describe('legacyRemainder', () => {
  it('is the stok total minus the sum of that item\'s batch sisa', () => {
    const batches = [batch('b1', 'semen', 12000, '2026-09-01T00:00:00.000Z'), batch('b2', 'pasir', 5000, '2026-09-01T00:00:00.000Z')]
    expect(legacyRemainder(17000, batches, 'semen')).toBe(5000)
  })

  it('ignores other items\' batches', () => {
    const batches = [batch('b1', 'pasir', 5000, '2026-09-01T00:00:00.000Z')]
    expect(legacyRemainder(10000, batches, 'semen')).toBe(10000)
  })
})

describe('availableForLine', () => {
  it('is the batch\'s sisa minus what other cart lines already claim from it', () => {
    const b = { batchId: 'b1', sisa: 40000 }
    const otherLines = [{ itemId: 'semen', batchId: 'b1', qty: 15000 }, { itemId: 'pasir', batchId: 'b2', qty: 9000 }]
    expect(availableForLine(b, otherLines)).toBe(25000)
  })

  it('is the full sisa when no other line claims this batch', () => {
    expect(availableForLine({ batchId: 'b1', sisa: 40000 }, [])).toBe(40000)
  })
})

describe('pickDefaultBatch', () => {
  it('picks the legacy pool (no batch) when it alone covers the qty', () => {
    const result = pickDefaultBatch('semen', 5000, 10000, [], [])
    expect(result.batchId).toBeUndefined()
    expect(result.warning).toBeUndefined()
  })

  it('picks the oldest batch with enough availability when the legacy pool cannot cover it', () => {
    const batches = [batch('newer', 'semen', 40000, '2026-09-10T00:00:00.000Z'), batch('older', 'semen', 40000, '2026-09-01T00:00:00.000Z')]
    const result = pickDefaultBatch('semen', 5000, 0, batches, [])
    expect(result.batchId).toBe('older')
    expect(result.warning).toBeUndefined()
  })

  it('falls through to a batch with insufficient availability and warns, rather than blocking', () => {
    const batches = [batch('only', 'semen', 3000, '2026-09-01T00:00:00.000Z')]
    const result = pickDefaultBatch('semen', 5000, 0, batches, [])
    expect(result.batchId).toBe('only')
    expect(result.warning).toBeDefined()
  })

  it('returns no batch when there is no legacy pool and no batch at all', () => {
    const result = pickDefaultBatch('semen', 5000, 0, [], [])
    expect(result.batchId).toBeUndefined()
  })

  it('accounts for what other cart lines already claim from the same batch', () => {
    const batches = [batch('b1', 'semen', 10000, '2026-09-01T00:00:00.000Z')]
    const otherLines = [{ itemId: 'semen', batchId: 'b1', qty: 8000 }]
    // Only 2000 left in b1; asking for 5000 should warn, not silently pick b1 as if it had 10000.
    const result = pickDefaultBatch('semen', 5000, 0, batches, otherLines)
    expect(result.warning).toBeDefined()
  })
})

describe('planSplit', () => {
  it('fills from the oldest batch first, then the next, until qty is covered', () => {
    const batches = [batch('newer', 'semen', 40000, '2026-09-10T00:00:00.000Z'), batch('older', 'semen', 3000, '2026-09-01T00:00:00.000Z')]
    const plan = planSplit('semen', 10000, batches, [])
    expect(plan).toEqual([{ batchId: 'older', qty: 3000 }, { batchId: 'newer', qty: 7000 }])
  })

  it('stops once qty is fully covered, without touching later batches', () => {
    const batches = [batch('a', 'semen', 20000, '2026-09-01T00:00:00.000Z'), batch('b', 'semen', 20000, '2026-09-05T00:00:00.000Z')]
    const plan = planSplit('semen', 5000, batches, [])
    expect(plan).toEqual([{ batchId: 'a', qty: 5000 }])
  })

  it('skips a batch with nothing available and moves to the next', () => {
    const otherLines = [{ itemId: 'semen', batchId: 'a', qty: 20000 }]
    const batches = [batch('a', 'semen', 20000, '2026-09-01T00:00:00.000Z'), batch('b', 'semen', 10000, '2026-09-05T00:00:00.000Z')]
    const plan = planSplit('semen', 4000, batches, otherLines)
    expect(plan).toEqual([{ batchId: 'b', qty: 4000 }])
  })
})
