import { describe, it, expect } from 'vitest'
import { buildRiwayatRows, type BatchWithMeta, type LegacyInput } from './riwayatStok'
import type { Batch } from '../../domain/projections/batches'

const makeBatch = (over: Partial<Batch>): Batch => ({
  batchId: 'b0', itemId: 'u1', hargaJual: 65000, tanggalBeli: '2026-09-01T00:00:00.000Z',
  diterima: 0, sisa: 0, metaUpdatedAt: '2026-09-01T00:00:00.000Z', metaUpdatedByEventId: 'e0',
  lastMovementAt: '2026-09-01T00:00:00.000Z', lastMovementEventId: 'e0',
  ...over,
})

describe('buildRiwayatRows', () => {
  it('sorts batch rows newest tanggalBeli first, converting milli-units to whole units', () => {
    const older: BatchWithMeta = {
      batch: makeBatch({ batchId: 'b1', itemId: 'u1', tanggalBeli: '2026-09-02T05:00:00.000Z', diterima: 50000, sisa: 0, hargaJual: 65000, hargaBeli: 58000 }),
      supplierNama: 'CV Maju', transaksiCount: 14, ukuran: '50 kg',
    }
    const newer: BatchWithMeta = {
      batch: makeBatch({ batchId: 'b2', itemId: 'u1', tanggalBeli: '2026-09-15T05:00:00.000Z', diterima: 40000, sisa: 32000, hargaJual: 67000, hargaBeli: 60000 }),
      supplierNama: 'UD Sentosa', transaksiCount: 3, ukuran: '50 kg',
    }

    const rows = buildRiwayatRows([older, newer], [])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ kind: 'batch', batchId: 'b2', diterima: 40, sisa: 32, transaksiCount: 3, supplierNama: 'UD Sentosa' })
    expect(rows[1]).toMatchObject({ kind: 'batch', batchId: 'b1', diterima: 50, sisa: 0 })
  })

  it('carries supplierId and hargaBeli through for a caller that needs the raw batch fields (e.g. Koreksi pembelian prefill)', () => {
    const withSupplier: BatchWithMeta = {
      batch: makeBatch({ batchId: 'b1', supplierId: 's1', hargaBeli: 58000 }),
      supplierNama: 'CV Maju', transaksiCount: 0, ukuran: '50 kg',
    }

    const rows = buildRiwayatRows([withSupplier], [])

    expect(rows[0]).toMatchObject({ kind: 'batch', supplierId: 's1', hargaBeli: 58000 })
  })

  it('appends a legacy row when its remainder is nonzero', () => {
    const legacy: LegacyInput = { itemId: 'u1', ukuran: '50 kg', sisaMilli: 5000, transaksiCount: 2 }

    const rows = buildRiwayatRows([], [legacy])

    expect(rows).toEqual([{ kind: 'legacy', itemId: 'u1', ukuran: '50 kg', sisa: 5, transaksiCount: 2 }])
  })

  it('omits the legacy row entirely when its remainder is exactly zero', () => {
    const legacy: LegacyInput = { itemId: 'u1', ukuran: '50 kg', sisaMilli: 0, transaksiCount: 0 }

    expect(buildRiwayatRows([], [legacy])).toEqual([])
  })

  it('keeps a negative legacy remainder visible rather than clamping it to zero', () => {
    const legacy: LegacyInput = { itemId: 'u1', ukuran: '50 kg', sisaMilli: -3000, transaksiCount: 0 }

    const rows = buildRiwayatRows([], [legacy])

    expect(rows).toEqual([{ kind: 'legacy', itemId: 'u1', ukuran: '50 kg', sisa: -3, transaksiCount: 0 }])
  })

  it('places every legacy row after every batch row, regardless of item order given', () => {
    const batchRow: BatchWithMeta = { batch: makeBatch({ batchId: 'b1', tanggalBeli: '2026-09-01T00:00:00.000Z' }), transaksiCount: 0, ukuran: '50 kg' }
    const legacy: LegacyInput = { itemId: 'u1', ukuran: '50 kg', sisaMilli: 5000, transaksiCount: 0 }

    const rows = buildRiwayatRows([batchRow], [legacy])

    expect(rows.map(r => r.kind)).toEqual(['batch', 'legacy'])
  })
})
