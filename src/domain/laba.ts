import { multiplyByQty, rupiah } from './money'

/**
 * (hargaSatuan - hargaBeli) * qty, or null when hargaBeli is unknown - never
 * a fake zero-cost margin. The UI shows "-" for null and totals state how
 * many lines lack cost (flow spec §8, "degrade honestly").
 */
export function laba(hargaSatuan: number, hargaBeli: number | undefined, qtyMilli: number): number | null {
  if (hargaBeli === undefined) return null
  return multiplyByQty(rupiah(hargaSatuan - hargaBeli), qtyMilli)
}
