import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { loadKategoriEntries } from '../../data/kategoriQueries'
import { systemClock } from '../../domain/clock'
import { useHariIni } from '../shared/useHariIni'
import {
  kategoriNamaPerItem, rentangLaporan, summarizeLaporan,
  type LaporanPilihan, type LaporanRingkasan, type Rentang,
} from '../../domain/laporan'

export type LaporanData = { rentang: Rentang; sekarang: LaporanRingkasan; sebelumnya: LaporanRingkasan }

// Midnight of the given day key, shifted by whole days. Only bounds the index
// scan: summarizeLaporan does the exact local-day bucketing.
const boundary = (dayKey: string, shiftDays: number): string => {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d + shiftDays).toISOString()
}

/**
 * Reads what Laporan needs and summarises it twice: the chosen period and the
 * previous equal one (for the delta). Sales are fetched by business date, so a
 * backdated nota lands where it belongs. Every batch is loaded: its cost is
 * looked up by id from a sale line, and a batch bought before the period can
 * still have been sold from inside it. toko-scale, same budget as useKatalog.
 * Undefined while the first query resolves.
 */
export function useLaporan(pilihan: LaporanPilihan): LaporanData | undefined {
  // Keyed by value: a custom range is a fresh object on every render.
  // "Bulan ini" and "hari ini" mean something else after midnight: recompute when the day turns.
  const hariIni = useHariIni()
  const pilihanKey = typeof pilihan === 'string' ? pilihan : `${pilihan.from}|${pilihan.to}`
  return useLiveQuery(async () => {
    const { sekarang, sebelumnya } = rentangLaporan(pilihan, systemClock.now())
    const [sales, batches, items, barang, entries, payments, expenses] = await Promise.all([
      db.salesProj.where('occurredAt').between(boundary(sebelumnya.from, -1), boundary(sekarang.to, 2), true, true).toArray(),
      db.batchesProj.toArray(),
      db.itemsProj.toArray(),
      db.barangProj.toArray(),
      loadKategoriEntries(),
      db.paymentsProj.toArray(),
      db.expensesProj.where('occurredAt').between(boundary(sebelumnya.from, -1), boundary(sekarang.to, 2), true, true).toArray(),
    ])
    const kategoriOf = kategoriNamaPerItem(items, barang, entries)
    return {
      rentang: sekarang,
      sekarang: summarizeLaporan(sales, batches, kategoriOf, sekarang, payments, expenses),
      sebelumnya: summarizeLaporan(sales, batches, kategoriOf, sebelumnya, payments, expenses),
    }
  }, [pilihanKey, hariIni])
}
