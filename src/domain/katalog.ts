import type { Item } from './projections/items'
import type { Barang } from './projections/barang'

export type BarangGroup = {
  barangId: string
  nama: string
  kategori?: string
  diarsipkan: boolean
  ukuran: Item[]
}

/**
 * Groups ukuran (items) under their Kamus Barang parent. An item with no
 * barangId predates Kamus Barang entirely - rather than requiring a
 * migration event to backfill one, it gets its own virtual barang, keyed
 * item-<itemId> so it can never collide with a real BarangUpserted id, with
 * its own nama/kategori/diarsipkan standing in for the barang's.
 */
export function groupUkuranByBarang(items: Item[], barangById: Record<string, Barang>): BarangGroup[] {
  const groups = new Map<string, BarangGroup>()

  for (const item of items) {
    const barangId = item.barangId ?? `item-${item.id}`
    const existing = groups.get(barangId)
    if (existing) {
      existing.ukuran.push(item)
      continue
    }

    const parent = item.barangId ? barangById[item.barangId] : undefined
    groups.set(barangId, {
      barangId,
      nama: parent?.nama ?? item.nama,
      kategori: parent?.kategori ?? item.kategori,
      diarsipkan: parent?.diarsipkan ?? item.diarsipkan,
      ukuran: [item],
    })
  }

  return Array.from(groups.values())
}

/** Case/space-insensitive normal form, for the "mirip dengan..." warning. */
export function normalizeUkuran(ukuran: string): string {
  return ukuran.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Stricter than normalizeUkuran: strips whitespace entirely rather than
 * just collapsing it, so "50kg" and "50 kg" - the most common near-duplicate
 * a shop owner actually types - compare equal. Kept separate from
 * normalizeUkuran, whose own collapsed-not-stripped form is still what a
 * caller would want to display.
 */
const compactUkuran = (ukuran: string): string => normalizeUkuran(ukuran).replace(/\s+/g, '')

/**
 * Returns the existing ukuran text that normalizes the same as `candidate`,
 * so the UI can offer "Pakai yang ada" instead of creating a near-duplicate
 * (e.g. "50 kg" vs "50KG" vs "50kg").
 */
export function findNearDuplicate(candidate: string, existingUkuran: string[]): string | undefined {
  const key = compactUkuran(candidate)
  return existingUkuran.find(u => compactUkuran(u) === key)
}
