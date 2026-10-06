import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Customer } from '../../domain/projections/customers'

export function useCustomers(): Customer[] | undefined {
  return useLiveQuery(async () => {
    const customers = await db.customersProj.toArray()
    return customers.sort((a, b) => a.nama.localeCompare(b.nama))
  }, [])
}
