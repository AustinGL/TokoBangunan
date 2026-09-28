import { useCallback, useMemo, useState } from 'react'
import { toBase, type UnitDef } from '../../domain/quantity'
import { add, multiplyByQty, rupiah } from '../../domain/money'

/**
 * In-memory cart state, pre-commit. A pure state container: no Dexie reads
 * of its own, no awareness of live stock/batch levels - resolving which
 * batch (or the legacy pool) an add or a split should target is entirely
 * the caller's job (Kasir.tsx's add handler; CartPanel's batch chip), the
 * same separation Phase 2's own useCart already established.
 *
 * A line is now identified by (itemId, batchId) together, not itemId
 * alone: two lines can legitimately share an itemId once they draw from
 * different batches (a manual batch switch, or a one-tap split).
 * batchId undefined means the legacy pool ("Stok lama" - stock never
 * folded into any batch).
 */

export type CartLine = {
  itemId: string
  /** undefined: the legacy pool ("Stok lama"). */
  batchId?: string
  nama: string
  unit: string
  qtyWhole: number
  qty: number
  /**
   * The price currently in effect, or null when it has never been filled
   * in (the resolved default was 0 - "belum ada harga"). null blocks save
   * (CartPanel's own concern); 0 is a real, deliberately-set price (a
   * bonus item), distinct from null.
   */
  hargaSatuan: number | null
  /** The default price snapshotted when this line was added or last re-priced by a batch change - the batch's own harga jual, or the ukuran's default for the legacy pool. hargaSatuan !== hargaNormal is the "Harga diubah" flag (matches RecordSaleLine's own doc comment in commands.ts). */
  hargaNormal: number
  /** null exactly when hargaSatuan is null. */
  subtotal: number | null
}

/** What a caller resolves from the live catalog before adding a line. */
export type CartItemInput = { id: string; nama: string; baseUnit: string }

export type SplitLineInput = { batchId: string | undefined; qtyWhole: number; hargaNormal: number }

const baseUnitDef = (unit: string): UnitDef => ({ unit, factor: 1 })
const sameLine = (line: CartLine, itemId: string, batchId: string | undefined): boolean =>
  line.itemId === itemId && line.batchId === batchId

function buildLine(
  item: CartItemInput, batchId: string | undefined, qtyWhole: number, hargaNormal: number, hargaSatuan: number | null,
): CartLine {
  const qty = toBase(qtyWhole, baseUnitDef(item.baseUnit))
  const subtotal = hargaSatuan === null ? null : multiplyByQty(rupiah(hargaSatuan), qty)
  return { itemId: item.id, batchId, nama: item.nama, unit: item.baseUnit, qtyWhole, qty, hargaSatuan, hargaNormal, subtotal }
}

const asItemInput = (line: CartLine): CartItemInput => ({ id: line.itemId, nama: line.nama, baseUnit: line.unit })

export type UseCartResult = {
  lines: CartLine[]
  subtotal: number
  /** Adds a new (itemId, batchId) line at qty 1, priced at hargaNormal (or increments an existing line for the same pair by 1, preserving whatever price it already carries). */
  addItem: (item: CartItemInput, batchId: string | undefined, hargaNormal: number) => void
  /** Sets a line's whole-unit quantity directly. qtyWhole <= 0 removes the line. */
  setQtyWhole: (itemId: string, batchId: string | undefined, qtyWhole: number) => void
  /** Sets (or, with null, clears) a line's current price - the manual-price-edit affordance. */
  setHargaSatuan: (itemId: string, batchId: string | undefined, hargaSatuan: number | null) => void
  /** Moves a line to a different batch, keeping its qty. An unedited price re-prices to the new batch's own default (hargaNormal); a manually-edited price survives unchanged. Merges into an already-present line for the destination batch, if any. */
  changeBatch: (itemId: string, fromBatchId: string | undefined, toBatchId: string | undefined, hargaNormal: number) => void
  /** Replaces one line with several, one per batch in the plan (each new/target line's own hargaNormal already resolved by the caller, matching batchPick.planSplit's output). */
  applySplit: (itemId: string, fromBatchId: string | undefined, splits: SplitLineInput[]) => void
  removeItem: (itemId: string, batchId: string | undefined) => void
  clear: () => void
}

export function useCart(): UseCartResult {
  const [lines, setLines] = useState<CartLine[]>([])

  const addItem = useCallback((item: CartItemInput, batchId: string | undefined, hargaNormal: number) => {
    setLines(prev => {
      const existing = prev.find(l => sameLine(l, item.id, batchId))
      if (existing) {
        return prev.map(l => sameLine(l, item.id, batchId)
          ? buildLine(item, batchId, l.qtyWhole + 1, l.hargaNormal, l.hargaSatuan)
          : l)
      }
      const hargaSatuan = hargaNormal === 0 ? null : hargaNormal
      return [...prev, buildLine(item, batchId, 1, hargaNormal, hargaSatuan)]
    })
  }, [])

  const setQtyWhole = useCallback((itemId: string, batchId: string | undefined, qtyWhole: number) => {
    setLines(prev => {
      if (qtyWhole <= 0) return prev.filter(l => !sameLine(l, itemId, batchId))
      return prev.map(l => sameLine(l, itemId, batchId)
        ? buildLine(asItemInput(l), l.batchId, qtyWhole, l.hargaNormal, l.hargaSatuan)
        : l)
    })
  }, [])

  const setHargaSatuan = useCallback((itemId: string, batchId: string | undefined, hargaSatuan: number | null) => {
    setLines(prev => prev.map(l => sameLine(l, itemId, batchId)
      ? buildLine(asItemInput(l), l.batchId, l.qtyWhole, l.hargaNormal, hargaSatuan)
      : l))
  }, [])

  const changeBatch = useCallback((
    itemId: string, fromBatchId: string | undefined, toBatchId: string | undefined, hargaNormal: number,
  ) => {
    setLines(prev => {
      const existing = prev.find(l => sameLine(l, itemId, fromBatchId))
      if (!existing) return prev
      const wasManual = existing.hargaSatuan !== null && existing.hargaSatuan !== existing.hargaNormal
      const nextHargaSatuan = wasManual ? existing.hargaSatuan : (hargaNormal === 0 ? null : hargaNormal)
      const withoutOld = prev.filter(l => !sameLine(l, itemId, fromBatchId))
      const target = withoutOld.find(l => sameLine(l, itemId, toBatchId))
      if (target) {
        return withoutOld.map(l => sameLine(l, itemId, toBatchId)
          ? buildLine(asItemInput(l), toBatchId, l.qtyWhole + existing.qtyWhole, l.hargaNormal, l.hargaSatuan)
          : l)
      }
      return [...withoutOld, buildLine(asItemInput(existing), toBatchId, existing.qtyWhole, hargaNormal, nextHargaSatuan)]
    })
  }, [])

  const applySplit = useCallback((itemId: string, fromBatchId: string | undefined, splits: SplitLineInput[]) => {
    setLines(prev => {
      const existing = prev.find(l => sameLine(l, itemId, fromBatchId))
      if (!existing) return prev
      const item = asItemInput(existing)
      let next = prev.filter(l => !sameLine(l, itemId, fromBatchId))
      for (const split of splits) {
        const target = next.find(l => sameLine(l, itemId, split.batchId))
        next = target
          ? next.map(l => sameLine(l, itemId, split.batchId)
              ? buildLine(item, split.batchId, l.qtyWhole + split.qtyWhole, l.hargaNormal, l.hargaSatuan)
              : l)
          : [...next, buildLine(item, split.batchId, split.qtyWhole, split.hargaNormal, split.hargaNormal === 0 ? null : split.hargaNormal)]
      }
      return next
    })
  }, [])

  const removeItem = useCallback((itemId: string, batchId: string | undefined) => {
    setLines(prev => prev.filter(l => !sameLine(l, itemId, batchId)))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => add(sum, rupiah(line.subtotal ?? 0)), rupiah(0)),
    [lines],
  )

  return { lines, subtotal, addItem, setQtyWhole, setHargaSatuan, changeBatch, applySplit, removeItem, clear }
}
