import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'

/**
 * The shop's name for the payment reminder: null while the first query
 * resolves (so the UI never flashes "not set"), then the name, or '' when none.
 */
export function useNamaToko(): string | null {
  const toko = useLiveQuery(async () => (await db.tokoProj.get('toko')) ?? { nama: '' }, [], null)
  return toko === null ? null : toko.nama
}
