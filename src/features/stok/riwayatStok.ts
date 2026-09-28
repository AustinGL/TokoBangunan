import type { Batch } from '../../domain/projections/batches'
import { fromBase, qty } from '../../domain/quantity'

export type RiwayatBatchRow = {
  kind: 'batch'
  batchId: string
  itemId: string
  ukuran: string
  tanggalBeli: string
  supplierId?: string
  supplierNama?: string
  diterima: number
  hargaBeli?: number
  hargaJual: number
  sisa: number
  transaksiCount: number
}

export type RiwayatLegacyRow = {
  kind: 'legacy'
  itemId: string
  ukuran: string
  sisa: number
  transaksiCount: number
}

export type RiwayatRow = RiwayatBatchRow | RiwayatLegacyRow

/** One batch plus the data a live-query join already looked up for it - see useRiwayatStok.ts. */
export type BatchWithMeta = {
  batch: Batch
  supplierNama?: string
  transaksiCount: number
  /** The item's own baseUnit text (e.g. "50 kg"), for both display and the milli-to-whole conversion below - every item's own unit factor is 1 in this phase (quantity.ts), so this doubles as the conversion unit. */
  ukuran: string
}

export type LegacyInput = {
  itemId: string
  ukuran: string
  /** total stok (stokProj) minus the sum of this item's own batch sisa, in milli-units. Can be negative if upstream data is inconsistent - shown as-is, never clamped. */
  sisaMilli: number
  transaksiCount: number
}

/**
 * Reshapes already-joined batch and legacy data into display rows: newest
 * purchase first, with every legacy ("Stok lama") row sunk to the bottom
 * regardless of its own item's order - a legacy remainder predates
 * per-batch tracking entirely, so it has no tanggalBeli to sort by. A
 * legacy row is only produced when its remainder is nonzero; a negative
 * remainder is kept (not clamped) so a data inconsistency stays visible
 * rather than silently hidden.
 */
export function buildRiwayatRows(batches: BatchWithMeta[], legacies: LegacyInput[]): RiwayatRow[] {
  const batchRows: RiwayatBatchRow[] = batches
    .map(({ batch, supplierNama, transaksiCount, ukuran }): RiwayatBatchRow => ({
      kind: 'batch',
      batchId: batch.batchId,
      itemId: batch.itemId,
      ukuran,
      tanggalBeli: batch.tanggalBeli,
      supplierId: batch.supplierId,
      supplierNama,
      diterima: fromBase(qty(batch.diterima), { unit: ukuran, factor: 1 }),
      hargaBeli: batch.hargaBeli,
      hargaJual: batch.hargaJual,
      sisa: fromBase(qty(batch.sisa), { unit: ukuran, factor: 1 }),
      transaksiCount,
    }))
    .sort((a, b) => b.tanggalBeli.localeCompare(a.tanggalBeli))

  const legacyRows: RiwayatLegacyRow[] = legacies
    .filter(l => l.sisaMilli !== 0)
    .map((l): RiwayatLegacyRow => ({
      kind: 'legacy',
      itemId: l.itemId,
      ukuran: l.ukuran,
      sisa: fromBase(qty(l.sisaMilli), { unit: l.ukuran, factor: 1 }),
      transaksiCount: l.transaksiCount,
    }))

  return [...batchRows, ...legacyRows]
}
