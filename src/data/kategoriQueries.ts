import { db } from './db'
import { buildKategoriList, type KategoriEntry } from '../domain/kategori'

/**
 * Master rows plus legacy text from barang and from legacy items that have no
 * barang. An item WITH a barang is skipped: its kategori snapshot is stale
 * by design (the barang owns the value).
 */
export async function loadKategoriEntries(): Promise<KategoriEntry[]> {
  const [master, barang, items] = await Promise.all([
    db.kategoriProj.toArray(), db.barangProj.toArray(), db.itemsProj.toArray(),
  ])
  return buildKategoriList(master, [...barang, ...items.filter(i => !i.barangId)])
}
