import { useLiveQuery } from 'dexie-react-hooks'
import { loadKategoriEntries } from '../../data/kategoriQueries'
import type { KategoriEntry } from '../../domain/kategori'

/** Every kategori: master rows (archived included) plus legacy names not yet written as rows. */
export function useKategori(): KategoriEntry[] | undefined {
  return useLiveQuery(() => loadKategoriEntries(), [])
}
