import type { BarangRow, UkuranRow } from '../shared/useKatalog'
import { worstStatus, type StokStatus } from '../../domain/stokStatus'
import { rupiah, type Rupiah } from '../../domain/money'

export type StokStatusFilter = 'semua' | 'menipis' | 'habis'

export type StokFilterState = {
  search: string
  status: StokStatusFilter
  /** null means "semua kategori". */
  kategori: string | null
}

export const EMPTY_STOK_FILTERS: StokFilterState = { search: '', status: 'semua', kategori: null }

export type StokBarangRow = {
  barangId: string
  nama: string
  kategori?: string
  virtual: boolean
  ukuran: UkuranRow[]
  status: StokStatus
  hargaMin: Rupiah
  hargaMax: Rupiah
}

/**
 * Reshapes useKatalog's BarangRow[] for the Stok list: drops archived
 * barang and archived ukuran entirely (a retired size or barang has
 * nothing to stock), then drops any barang left with zero ukuran as a
 * result - an empty row would have nothing to show anyway. Adds the two
 * values every row needs that useKatalog doesn't already compute: the
 * worst status across the barang's own (surviving) ukuran, and the harga
 * eceran range.
 */
export function toStokRows(rows: BarangRow[]): StokBarangRow[] {
  const result: StokBarangRow[] = []
  for (const r of rows) {
    if (r.diarsipkan) continue
    const ukuran = r.ukuran.filter(u => !u.diarsipkan)
    if (ukuran.length === 0) continue

    const prices = ukuran.map(u => u.hargaEceran)
    result.push({
      barangId: r.barangId,
      nama: r.nama,
      kategori: r.kategori,
      virtual: r.virtual,
      ukuran,
      status: worstStatus(ukuran.map(u => u.status)),
      hargaMin: rupiah(Math.min(...prices)),
      hargaMax: rupiah(Math.max(...prices)),
    })
  }
  return result
}

/**
 * Plain synchronous filtering over toStokRows's output, kept pure (not
 * folded into a hook) so Stok.tsx and its tests can exercise it without a
 * live Dexie instance - same split the old useStokList.ts's own
 * filterStokRows used.
 */
export function filterStokRows(rows: StokBarangRow[], filters: StokFilterState): StokBarangRow[] {
  const search = filters.search.trim().toLowerCase()

  return rows.filter(row => {
    if (search) {
      const matchesNama = row.nama.toLowerCase().includes(search)
      const matchesUkuran = row.ukuran.some(u => u.ukuran.toLowerCase().includes(search))
      const matchesBarcode = row.ukuran.some(u => u.barcode?.toLowerCase().includes(search) ?? false)
      if (!matchesNama && !matchesUkuran && !matchesBarcode) return false
    }
    if (filters.status !== 'semua' && row.status !== filters.status) return false
    if (filters.kategori !== null && row.kategori !== filters.kategori) return false
    return true
  })
}

export type StokSummary = { totalBarang: number; menipisCount: number; habisCount: number }

/**
 * The header's "12 barang - 3 menipis - 1 habis" counts. The caller (this
 * screen's own component, not this module) decides what to pass in - it
 * must always be every row toStokRows produced, not the currently
 * filtered/searched subset, so the header stays a stable overview while
 * search/status/kategori narrow only the list below it.
 */
export function summarizeStokRows(rows: StokBarangRow[]): StokSummary {
  return {
    totalBarang: rows.length,
    menipisCount: rows.filter(r => r.status === 'menipis').length,
    habisCount: rows.filter(r => r.status === 'habis').length,
  }
}
