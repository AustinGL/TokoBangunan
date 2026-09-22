import { useCallback, useMemo, useState } from 'react'
import { toBase, type UnitDef } from '../../domain/quantity'
import { add, multiplyByQty, rupiah } from '../../domain/money'

/**
 * In-memory cart state, pre-commit. Plan's file structure note for
 * Kasir: "in-memory cart state, pre-commit." A pure state container: no
 * Dexie reads of its own, no awareness of live stock levels (whether a
 * quantity exceeds what is in stock is Task 6b's CartPanel/screen-assembly
 * concern, kept separate on purpose so this hook has one job).
 *
 * Sale lines only use baseUnit this phase (plan's "Explicitly out of scope"
 * list: no multi-satuan unit switching in the cart, no harga bertingkat /
 * price-tier logic). hargaSatuan is always the item's current hargaEceran
 * at add-time.
 */

export type CartLine = {
  itemId: string
  nama: string
  /** Always the item's baseUnit this phase. */
  unit: string
  /** Whole units the owner sees/edits, e.g. 3 (sak). */
  qtyWhole: number
  /** Milli-units, derived: toBase(qtyWhole, { unit, factor: 1 }). */
  qty: number
  /** Rupiah per whole unit, snapshotted at add-time. */
  hargaSatuan: number
  /** multiplyByQty(hargaSatuan, qty). */
  subtotal: number
}

/** What ProductCard's parent reads from the live catalog to add a line. */
export type CartItemInput = {
  id: string
  nama: string
  baseUnit: string
  hargaEceran: number
}

const baseUnitDef = (unit: string): UnitDef => ({ unit, factor: 1 })

/**
 * Snapshots nama/hargaSatuan/unit as given at this call, not read again
 * later: saleLineSchema itself snapshots rather than references for the
 * same reason ("hargaEceran on ItemUpserted can change after the sale; the
 * nota and margin math must reproduce what was actually charged").
 */
function buildLine(item: CartItemInput, qtyWhole: number): CartLine {
  const qty = toBase(qtyWhole, baseUnitDef(item.baseUnit))
  const hargaSatuan = item.hargaEceran
  const subtotal = multiplyByQty(rupiah(hargaSatuan), qty)
  return {
    itemId: item.id,
    nama: item.nama,
    unit: item.baseUnit,
    qtyWhole,
    qty,
    hargaSatuan,
    subtotal,
  }
}

export type UseCartResult = {
  lines: CartLine[]
  subtotal: number
  /** Adds a new line at qty 1, or increments an existing line by 1 whole unit. */
  addItem: (item: CartItemInput) => void
  /** Sets a line's whole-unit quantity directly. qtyWhole <= 0 removes the line. */
  setQtyWhole: (itemId: string, qtyWhole: number) => void
  removeItem: (itemId: string) => void
  clear: () => void
}

export function useCart(): UseCartResult {
  const [lines, setLines] = useState<CartLine[]>([])

  const addItem = useCallback((item: CartItemInput) => {
    setLines(prev => {
      const existing = prev.find(line => line.itemId === item.id)
      if (existing) {
        return prev.map(line =>
          line.itemId === item.id ? buildLine(item, line.qtyWhole + 1) : line,
        )
      }
      return [...prev, buildLine(item, 1)]
    })
  }, [])

  const setQtyWhole = useCallback((itemId: string, qtyWhole: number) => {
    setLines(prev => {
      // No "quantity zero" state in a cart: clear-cart-if-emptied is the
      // common POS convention, not explicitly spec'd here (judgment call).
      if (qtyWhole <= 0) return prev.filter(line => line.itemId !== itemId)
      return prev.map(line => {
        if (line.itemId !== itemId) return line
        // Recomputed from the line's own already-snapshotted price, not a
        // fresh catalog read: this hook has no catalog access and the
        // snapshot must not silently follow a later price change.
        return buildLine(
          { id: line.itemId, nama: line.nama, baseUnit: line.unit, hargaEceran: line.hargaSatuan },
          qtyWhole,
        )
      })
    })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setLines(prev => prev.filter(line => line.itemId !== itemId))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => add(sum, rupiah(line.subtotal)), rupiah(0)),
    [lines],
  )

  return { lines, subtotal, addItem, setQtyWhole, removeItem, clear }
}
