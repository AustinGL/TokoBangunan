import type { Kategori } from './projections/kategori'

export type KategoriEntry = { id: string; nama: string; diarsipkan: boolean; materialized: boolean }
/** What a barang (or a legacy item with no barang) knows about its kategori. */
export type KategoriSource = { kategoriId?: string; kategori?: string }

/**
 * The one normal form for "is this the same kategori": trimmed, inner space
 * collapsed, case-folded. Every device must compute the same ids from it, so
 * do not change it without a follow-up migration.
 */
export const normalizeKategoriName = (nama: string): string => nama.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * A kategori's id when it is first created from a name (typed in a picker, or
 * derived from a barang's legacy text). encodeURIComponent is injective, so
 * distinct normalized names never share an id, and two devices creating the
 * same name offline converge on one row instead of two.
 */
export const kategoriIdForName = (nama: string): string => `kat_${encodeURIComponent(normalizeKategoriName(nama))}`

const legacyText = (src: KategoriSource): string | undefined => {
  const text = src.kategori?.trim()
  return text ? text : undefined
}

export function effectiveKategoriId(src: KategoriSource): string | undefined {
  if (src.kategoriId) return src.kategoriId
  const text = legacyText(src)
  return text ? kategoriIdForName(text) : undefined
}

/**
 * Master rows plus one unmaterialized entry per distinct legacy name that has
 * no master row yet. Legacy text is never written back in bulk (that would
 * race with a rename on another device); an entry becomes a real row the first
 * time something writes it.
 */
export function buildKategoriList(master: Kategori[], sources: KategoriSource[]): KategoriEntry[] {
  const byId = new Map<string, KategoriEntry>()
  for (const row of master) {
    byId.set(row.id, { id: row.id, nama: row.nama, diarsipkan: row.diarsipkan, materialized: true })
  }
  for (const src of sources) {
    if (src.kategoriId) continue
    const text = legacyText(src)
    if (!text) continue
    const id = kategoriIdForName(text)
    if (!byId.has(id)) byId.set(id, { id, nama: text, diarsipkan: false, materialized: false })
  }
  return [...byId.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id-ID', { sensitivity: 'base' }))
}

export function resolveKategori(src: KategoriSource, byId: Map<string, KategoriEntry>): { id?: string; nama?: string } {
  const id = effectiveKategoriId(src)
  if (!id) return { id: undefined, nama: undefined }
  const entry = byId.get(id)
  if (entry) return { id, nama: entry.nama }
  return { id, nama: src.kategoriId ? undefined : legacyText(src) }
}
