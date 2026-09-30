import type { Kategori } from './projections/kategori'

export type KategoriEntry = { id: string; nama: string; diarsipkan: boolean; materialized: boolean }
/** What a barang (or a legacy item with no barang) knows about its kategori. */
export type KategoriSource = { kategoriId?: string; kategori?: string }

/** A high surrogate with no low one after it, or a low one with no high one before it. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/**
 * The one normal form for "is this the same kategori": trimmed, inner space
 * collapsed, Unicode-normalized (NFC, so a composed and a decomposed "cafe" are
 * one name), case-folded, and with any lone surrogate replaced by U+FFFD so the
 * id below can always be encoded (legacy text is arbitrary user data, and
 * encodeURIComponent throws on a lone surrogate).
 *
 * THIS FORM IS FROZEN. Every id derived from it is written into KategoriUpserted
 * events on the owner's devices and lives in the append-only log forever, so
 * changing any step (including NFC or the surrogate replacement) would give the
 * same name a new id. Do not change it without a data migration.
 */
export const normalizeKategoriName = (nama: string): string =>
  nama.trim().replace(/\s+/g, ' ').normalize('NFC').toLowerCase().replace(LONE_SURROGATE, '\uFFFD')

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
  // Names that tie (e.g. 'Cat' and 'cat') fall back to the id, so every device lists them in the same order.
  return [...byId.values()].sort((a, b) =>
    a.nama.localeCompare(b.nama, 'id-ID', { sensitivity: 'base' }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function resolveKategori(src: KategoriSource, byId: Map<string, KategoriEntry>): { id?: string; nama?: string } {
  const id = effectiveKategoriId(src)
  if (!id) return { id: undefined, nama: undefined }
  const entry = byId.get(id)
  if (entry) return { id, nama: entry.nama }
  return { id, nama: src.kategoriId ? undefined : legacyText(src) }
}
