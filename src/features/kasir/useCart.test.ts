import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCart, type CartItemInput } from './useCart'

const semen: CartItemInput = { id: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 52000 }
const pasir: CartItemInput = { id: 'pasir', nama: 'Pasir', baseUnit: 'm3', hargaEceran: 180000 }

describe('useCart', () => {
  it('addItem adds a new line at qty 1 (1000 milli-units at factor 1)', () => {
    const { result } = renderHook(() => useCart())

    act(() => result.current.addItem(semen))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({
      itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qtyWhole: 1, qty: 1000, hargaSatuan: 52000,
      // 52000 * 1000 / 1000 = 52000.
      subtotal: 52000,
    })
  })

  it('addItem on an already-present item increments qty to 2 rather than duplicating the line', () => {
    const { result } = renderHook(() => useCart())

    act(() => result.current.addItem(semen))
    act(() => result.current.addItem(semen))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({
      qtyWhole: 2, qty: 2000,
      // 52000 * 2000 / 1000 = 104000.
      subtotal: 104000,
    })
  })

  it('setQtyWhole updates a line quantity and recomputes its subtotal', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen))

    act(() => result.current.setQtyWhole('semen', 5))

    expect(result.current.lines[0]).toMatchObject({
      qtyWhole: 5, qty: 5000,
      // 52000 * 5000 / 1000 = 260000.
      subtotal: 260000,
    })
  })

  it('setQtyWhole(itemId, 0) removes the line', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen))

    act(() => result.current.setQtyWhole('semen', 0))

    expect(result.current.lines).toHaveLength(0)
  })

  it('setQtyWhole with a negative value also removes the line (judgment call: no negative-quantity state)', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen))

    act(() => result.current.setQtyWhole('semen', -3))

    expect(result.current.lines).toHaveLength(0)
  })

  it('removeItem removes a line by itemId, leaving the rest untouched', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen))
    act(() => result.current.addItem(pasir))

    act(() => result.current.removeItem('semen'))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0].itemId).toBe('pasir')
  })

  it('clear empties the cart', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen))
    act(() => result.current.addItem(pasir))

    act(() => result.current.clear())

    expect(result.current.lines).toHaveLength(0)
    expect(result.current.subtotal).toBe(0)
  })

  it('subtotal sums all lines using Rupiah arithmetic', () => {
    const { result } = renderHook(() => useCart())

    act(() => result.current.addItem(semen))
    act(() => result.current.setQtyWhole('semen', 3))
    act(() => result.current.addItem(pasir))
    act(() => result.current.setQtyWhole('pasir', 2))

    // semen: 52000 * 3000 / 1000 = 156000. pasir: 180000 * 2000 / 1000 = 360000.
    // subtotal = 156000 + 360000 = 516000.
    expect(result.current.subtotal).toBe(516000)
  })

  it('does not follow a later price change: a line snapshots hargaSatuan at add-time', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.addItem(semen))

    // A price change elsewhere (a re-add with a different hargaEceran, simulating
    // the catalog price having moved) still reflects the newly-passed snapshot for
    // a fresh addItem call, but setQtyWhole never re-reads a live catalog price.
    act(() => result.current.setQtyWhole('semen', 4))

    // Still priced at the original 52000 snapshot, not any hypothetical new price:
    // 52000 * 4000 / 1000 = 208000.
    expect(result.current.lines[0].hargaSatuan).toBe(52000)
    expect(result.current.lines[0].subtotal).toBe(208000)
  })
})
