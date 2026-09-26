import type { EventEnvelope } from '../events'
import type { UnitDef } from '../quantity'

export type Item = {
  id: string
  nama: string
  baseUnit: string
  units: UnitDef[]
  hargaEceran: number
  stokMinimum: number
  barcode?: string
  kategori?: string
  /** The Kamus Barang parent this ukuran belongs to. Absent on every item
   * created before Kamus Barang existed - katalog.ts's groupUkuranByBarang
   * gives those a virtual barang instead of requiring a migration event. */
  barangId?: string
  diarsipkan: boolean
  /** recordedAt of the write that produced this state, for last-write-wins. */
  updatedAt: string
  /**
   * id of the event that produced this state. UUIDv7 ids are time-sortable,
   * so this breaks ties when two writes share the same recordedAt: the event
   * with the greater id wins. This keeps the result independent of the order
   * events are folded in, which array order (and storage order for tied
   * timestamps) does not guarantee.
   */
  updatedByEventId: string
}

export type ItemsState = Record<string, Item>

export function reduceItems(state: ItemsState, event: EventEnvelope): ItemsState {
  if (event.type !== 'ItemUpserted') return state
  const payload = event.payload as Omit<Item, 'updatedAt' | 'updatedByEventId'>
  const existing = state[payload.id]
  if (existing) {
    // Last-write-wins by raw string comparison. That is only sound because
    // every stored recordedAt is canonical ISO-8601 Z form
    // (2026-09-18T09:00:00.000Z), which is lexicographically ordered the same
    // way it is chronologically ordered. Timestamps arriving from Postgres
    // carry a +00:00 offset instead, and are normalised to Z form at the
    // adapter boundary (data/sync.ts canonicalTimestamp) precisely so this
    // comparison stays valid. A mixed log would compare 'Z' against '+' and
    // tie-break by ASCII at the offset character.
    if (existing.updatedAt > event.recordedAt) return state
    if (existing.updatedAt === event.recordedAt && existing.updatedByEventId >= event.id) return state
  }
  return {
    ...state,
    [payload.id]: { ...payload, updatedAt: event.recordedAt, updatedByEventId: event.id },
  }
}

export const projectItems = (events: EventEnvelope[]): ItemsState =>
  events.reduce(reduceItems, {})
