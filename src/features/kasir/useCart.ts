import { useCallback, useMemo, useState } from 'react'
import { fromBase, qty, toBase, type UnitDef } from '../../domain/quantity'
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

/**
 * True when a line's current price was deliberately set by the owner rather
 * than inherited from a default: it diverges from hargaNormal, OR it is any
 * non-null price on a line whose default is 0 (such a line always starts at
 * null, "Isi harga", so a non-null price there - including an explicit 0
 * for a bonus item - can only have been typed in). A manual price must
 * survive anything that moves the line's quantity between batches
 * (changeBatch, applySplit), never silently reverting to a batch default.
 */
const isManualPrice = (line: CartLine): boolean =>
  line.hargaSatuan !== null && (line.hargaSatuan !== line.hargaNormal || line.hargaNormal === 0)

/**
 * The price units moved off `source` onto a batch whose own default is
 * `hargaNormal` must carry: the source's manual price if it has one (see
 * isManualPrice), otherwise that batch's default (null - "Isi harga" - for
 * a default of 0). Exported so CartPanel's split offer can tell, before
 * offering, whether merging into a destination batch's already-present line
 * would be price-safe (applySplit refuses a merge that is not).
 */
export function movedHargaSatuan(source: CartLine, hargaNormal: number): number | null {
  return isManualPrice(source) ? source.hargaSatuan : (hargaNormal === 0 ? null : hargaNormal)
}

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
  /**
   * Moves quantity out of one line into other batches, one entry per batch in the plan (each entry's own hargaNormal already resolved by the caller, matching batchPick.planSplit's output). Whatever the entries do not move to a different batch stays on the source line (an over-sell the plan could not cover is kept there, never dropped), so total quantity is always conserved; a plan allocating more than the line holds is refused. A manually-set source price is carried onto every resulting line, same as changeBatch; merging into an already-present destination line is only allowed when that line already carries the same price the moved units would (otherwise the whole split is refused, never silently re-priced).
   */
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
      const nextHargaSatuan = movedHargaSatuan(existing, hargaNormal)
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
      const sourceIndex = prev.findIndex(l => sameLine(l, itemId, fromBatchId))
      if (sourceIndex === -1) return prev
      const source = prev[sourceIndex]
      const unit = baseUnitDef(source.unit)
      const item = asItemInput(source)
      const milliOf = (entries: SplitLineInput[]) => entries.reduce((sum, s) => sum + toBase(s.qtyWhole, unit), 0)

      const entries = splits.filter(s => s.qtyWhole > 0)
      // A plan can never hand out more than the source line holds - that
      // would invent quantity out of nothing. Refuse it outright.
      if (milliOf(entries) > source.qty) return prev

      // Whatever the plan does not move to a DIFFERENT batch stays on the
      // source line: both an explicit entry for the source batch itself and
      // any shortfall the plan could not cover (batchPick.planSplit only
      // fills up to what the known batches actually have left). That
      // shortfall is an intentional, warned over-sell on the original batch
      // or legacy pool (flow spec D7: warn, never block) - never deleted.
      // Total quantity across the resulting lines always equals the source
      // line's own quantity.
      const moved = entries.filter(s => s.batchId !== fromBatchId)
      const keptMilli = source.qty - milliOf(moved)
      let next = keptMilli > 0
        ? prev.map((l, i) => i === sourceIndex
            ? buildLine(item, fromBatchId, fromBase(qty(keptMilli), unit), source.hargaNormal, source.hargaSatuan)
            : l)
        : prev.filter((_, i) => i !== sourceIndex)

      // Same rule as changeBatch: a manually-set price (a negotiated price,
      // or an explicit 0 for a bonus item) is carried onto every line the
      // split creates; an unedited one re-prices to each batch's own default.
      for (const split of moved) {
        const target = next.find(l => sameLine(l, itemId, split.batchId))
        const hargaSatuan = movedHargaSatuan(source, split.hargaNormal)
        // Merging into a destination batch's already-present line would
        // silently re-price the moved units to that line's own price (e.g.
        // paid units swallowed by a bonus line at 0). Refuse the whole split
        // rather than change a price nobody asked to change.
        if (target && target.hargaSatuan !== hargaSatuan) return prev
        next = target
          ? next.map(l => sameLine(l, itemId, split.batchId)
              ? buildLine(item, split.batchId, l.qtyWhole + split.qtyWhole, l.hargaNormal, l.hargaSatuan)
              : l)
          : [...next, buildLine(item, split.batchId, split.qtyWhole, split.hargaNormal, hargaSatuan)]
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
