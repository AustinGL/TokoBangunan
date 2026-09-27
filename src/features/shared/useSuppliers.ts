import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Supplier } from '../../domain/projections/suppliers'

export function useSuppliers(): Supplier[] | undefined {
  return useLiveQuery(async () => {
    const suppliers = await db.suppliersProj.toArray()
    return suppliers.sort((a, b) => a.nama.localeCompare(b.nama))
  }, [])
}
