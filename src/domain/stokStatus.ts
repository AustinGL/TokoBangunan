export type StokStatus = 'habis' | 'menipis' | 'aman'

/**
 * Status thresholds compare whole-unit quantity against stokMinimum, itself
 * stored in whole units (see commands.ts: stokMinimum is typed and stored
 * as-is, never passed through toBase).
 */
export function computeStokStatus(quantity: number, stokMinimum: number): StokStatus {
  if (quantity <= 0) return 'habis'
  if (quantity < stokMinimum) return 'menipis'
  return 'aman'
}

/** The worst of a set of statuses, e.g. across an ukuran's several batches. */
export function worstStatus(statuses: StokStatus[]): StokStatus {
  if (statuses.includes('habis')) return 'habis'
  if (statuses.includes('menipis')) return 'menipis'
  return 'aman'
}
