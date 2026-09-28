import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCart, type CartItemInput } from './useCart'

const semen: CartItemInput = { id: 'semen', nama: 'Semen Tiga Roda · 50 kg', baseUnit: '50 kg' }
const pasir: CartItemInput = { id: 'pasir', nama: 'Pasir Halus · m3', baseUnit: 'm3' }

describe('useCart: adding lines, keyed by item AND batch', () => {
  it('addItem adds a new line at qty 1, with hargaSatuan starting equal to hargaNormal', () => {
    const { result } = renderHook(() => useCart())

    act(() => result.current.addItem(semen, 'batch-1', 65000))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({
      itemId: 'semen', batchId: 'batch-1', nama: 'Semen Tiga Roda · 50 kg', unit: '50 kg',
      qtyWhole: 1, qty: 1000, hargaSatuan: 65000, hargaNormal: 65000, subtotal: 65000,
    })
  })

  it('addItem again for the SAME item and batch increments qty, preserving the current price', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.setHargaSatuan('semen', 'batch-1', 63000))

    // A repeat add-click (e.g. the owner taps + on the same ukuran card
    // again) must not silently reset the price they just negotiated back
    // to whatever hargaNormal this call happens to pass.
    act(() => result.current.addItem(semen, 'batch-1', 65000))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({ qtyWhole: 2, qty: 2000, hargaSatuan: 63000, hargaNormal: 65000 })
  })

  it('addItem for the SAME item but a DIFFERENT batch creates a separate line, not a merge', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))

    act(() => result.current.addItem(semen, 'batch-2', 67000))

    expect(result.current.lines).toHaveLength(2)
    expect(result.current.lines.map(l => l.batchId)).toEqual(['batch-1', 'batch-2'])
  })

  it('addItem with batchId undefined targets the legacy ("Stok lama") pool as its own line', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))

    act(() => result.current.addItem(semen, undefined, 65000))

    expect(result.current.lines).toHaveLength(2)
    expect(result.current.lines.find(l => l.batchId === undefined)).toBeDefined()
  })

  it('an ukuran whose default price is 0 (never purchased) starts with hargaSatuan null, not 0', () => {
    const { result } = renderHook(() => useCart())

    act(() => result.current.addItem(semen, undefined, 0))

    expect(result.current.lines[0].hargaSatuan).toBeNull()
    expect(result.current.lines[0].hargaNormal).toBe(0)
    expect(result.current.lines[0].subtotal).toBeNull()
  })
})

describe('useCart: quantity and manual price edits', () => {
  it('setQtyWhole updates only the matching (itemId, batchId) line and recomputes its subtotal', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.addItem(semen, 'batch-2', 67000))

    act(() => result.current.setQtyWhole('semen', 'batch-1', 5))

    const line1 = result.current.lines.find(l => l.batchId === 'batch-1')!
    const line2 = result.current.lines.find(l => l.batchId === 'batch-2')!
    expect(line1).toMatchObject({ qtyWhole: 5, qty: 5000, subtotal: 325000 })
    expect(line2).toMatchObject({ qtyWhole: 1 }) // untouched
  })

  it('setQtyWhole(id, batchId, 0) removes only that (itemId, batchId) line', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.addItem(semen, 'batch-2', 67000))

    act(() => result.current.setQtyWhole('semen', 'batch-1', 0))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0].batchId).toBe('batch-2')
  })

  it('setQtyWhole preserves a manually-edited price - it never re-reads a live catalog price', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.setHargaSatuan('semen', 'batch-1', 63000))

    act(() => result.current.setQtyWhole('semen', 'batch-1', 4))

    expect(result.current.lines[0]).toMatchObject({ hargaSatuan: 63000, hargaNormal: 65000, subtotal: 252000 })
  })

  it('setHargaSatuan sets a manual price; hargaSatuan !== hargaNormal is the "harga diubah" signal', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))

    act(() => result.current.setHargaSatuan('semen', 'batch-1', 60000))

    const line = result.current.lines[0]
    expect(line.hargaSatuan).toBe(60000)
    expect(line.hargaSatuan).not.toBe(line.hargaNormal)
  })

  it('setHargaSatuan accepts an explicit 0 as a real price (bonus items), distinct from null', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))

    act(() => result.current.setHargaSatuan('semen', 'batch-1', 0))

    expect(result.current.lines[0].hargaSatuan).toBe(0)
    expect(result.current.lines[0].subtotal).toBe(0)
  })

  it('setHargaSatuan(id, batchId, null) clears a line back to "belum diisi"', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))

    act(() => result.current.setHargaSatuan('semen', 'batch-1', null))

    expect(result.current.lines[0].hargaSatuan).toBeNull()
    expect(result.current.lines[0].subtotal).toBeNull()
  })
})

describe('useCart: changing a line\'s batch', () => {
  it('changeBatch moves a line to a new batch, keeping qty, and re-prices to the new batch\'s default when unedited', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.setQtyWhole('semen', 'batch-1', 3))

    act(() => result.current.changeBatch('semen', 'batch-1', 'batch-2', 67000))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({ batchId: 'batch-2', qtyWhole: 3, hargaSatuan: 67000, hargaNormal: 67000 })
  })

  it('changeBatch preserves a manually-edited price across the switch (spec: "a manual price survives a batch change")', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.setHargaSatuan('semen', 'batch-1', 60000))

    act(() => result.current.changeBatch('semen', 'batch-1', 'batch-2', 67000))

    expect(result.current.lines[0]).toMatchObject({ batchId: 'batch-2', hargaSatuan: 60000, hargaNormal: 67000 })
  })

  it('changeBatch onto a batch that already has its own line for this item merges the quantities', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.setQtyWhole('semen', 'batch-1', 2))
    act(() => result.current.addItem(semen, 'batch-2', 67000))
    act(() => result.current.setQtyWhole('semen', 'batch-2', 3))

    act(() => result.current.changeBatch('semen', 'batch-1', 'batch-2', 67000))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({ batchId: 'batch-2', qtyWhole: 5 })
  })
})

describe('useCart: one-tap split across batches', () => {
  it('applySplit replaces one line with several, one per batch in the plan', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.setQtyWhole('semen', 'batch-1', 10))

    act(() => result.current.applySplit('semen', 'batch-1', [
      { batchId: 'batch-1', qtyWhole: 6, hargaNormal: 65000 },
      { batchId: 'batch-2', qtyWhole: 4, hargaNormal: 67000 },
    ]))

    expect(result.current.lines).toHaveLength(2)
    const b1 = result.current.lines.find(l => l.batchId === 'batch-1')!
    const b2 = result.current.lines.find(l => l.batchId === 'batch-2')!
    expect(b1).toMatchObject({ qtyWhole: 6, hargaSatuan: 65000 })
    expect(b2).toMatchObject({ qtyWhole: 4, hargaSatuan: 67000 })
  })

  it('applySplit merges into an already-present destination line rather than duplicating it', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.setQtyWhole('semen', 'batch-1', 10))
    act(() => result.current.addItem(semen, 'batch-2', 67000)) // owner already has 1 unit from batch-2 separately

    act(() => result.current.applySplit('semen', 'batch-1', [
      { batchId: 'batch-2', qtyWhole: 10, hargaNormal: 67000 },
    ]))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({ batchId: 'batch-2', qtyWhole: 11 })
  })
})

describe('useCart: removeItem, clear, subtotal', () => {
  it('removeItem removes only the matching (itemId, batchId) line', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.addItem(semen, 'batch-2', 67000))
    act(() => result.current.addItem(pasir, undefined, 180000))

    act(() => result.current.removeItem('semen', 'batch-1'))

    expect(result.current.lines).toHaveLength(2)
    expect(result.current.lines.some(l => l.itemId === 'semen' && l.batchId === 'batch-1')).toBe(false)
  })

  it('clear empties the cart', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))

    act(() => result.current.clear())

    expect(result.current.lines).toHaveLength(0)
    expect(result.current.subtotal).toBe(0)
  })

  it('subtotal sums all priced lines using Rupiah arithmetic, treating a null-priced line as 0', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen, 'batch-1', 65000))
    act(() => result.current.setQtyWhole('semen', 'batch-1', 3)) // 195000
    act(() => result.current.addItem(pasir, undefined, 180000))
    act(() => result.current.setQtyWhole('pasir', undefined, 2)) // 360000
    act(() => result.current.addItem(semen, 'batch-2', 0)) // unpriced, contributes 0 to the running subtotal

    expect(result.current.subtotal).toBe(555000)
  })
})
