import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { hitungPiutang, type RingkasanPiutang } from '../../domain/piutang'
import { useHariIni } from '../shared/useHariIni'

/**
 * Every Bon customer who still owes something, in urgency order. The balance
 * arithmetic is domain/piutang.ts; this only reads the three projections.
 * Undefined while the first query resolves.
 */
export function usePiutang(): RingkasanPiutang | undefined {
  // A dependency, so the statuses are recomputed when the day turns, not only when data changes.
  const hariIni = useHariIni()
  return useLiveQuery(async () => {
    const [sales, payments, customers] = await Promise.all([
      db.salesProj.filter(s => s.metodeBayar === 'bon').toArray(),
      db.paymentsProj.toArray(),
      db.customersProj.toArray(),
    ])
    return hitungPiutang(sales, payments, customers, hariIni)
  }, [hariIni])
}
