import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'

/**
 * Not a where('perluDilengkapi') query: IndexedDB does not accept a boolean
 * as an index key, and suppliersProj has no such index anyway. A plain
 * filter over toArray() is the same toko-scale trade-off useKatalog/
 * useStokList already make.
 */
export function useSupplierPerluDilengkapiCount(): number {
  const count = useLiveQuery(async () => {
    const suppliers = await db.suppliersProj.toArray()
    return suppliers.filter(s => s.perluDilengkapi).length
  }, [])
  return count ?? 0
}
