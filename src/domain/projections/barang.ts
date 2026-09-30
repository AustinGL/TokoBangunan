import type { EventEnvelope } from '../events'

export type Barang = {
  id: string
  nama: string
  kategori?: string
  /** Master link; wins over legacy `kategori` text. */
  kategoriId?: string
  diarsipkan: boolean
  /** recordedAt of the write that produced this state, for last-write-wins. */
  updatedAt: string
  /** id of the event that produced this state, tie-breaking an identical recordedAt (see reduceItems, the same template this reducer copies). */
  updatedByEventId: string
}

export type BarangState = Record<string, Barang>

export function reduceBarang(state: BarangState, event: EventEnvelope): BarangState {
  if (event.type !== 'BarangUpserted') return state
  const payload = event.payload as Omit<Barang, 'updatedAt' | 'updatedByEventId'>
  const existing = state[payload.id]
  if (existing) {
    if (existing.updatedAt > event.recordedAt) return state
    if (existing.updatedAt === event.recordedAt && existing.updatedByEventId >= event.id) return state
  }
  return {
    ...state,
    [payload.id]: { ...payload, updatedAt: event.recordedAt, updatedByEventId: event.id },
  }
}

export const projectBarang = (events: EventEnvelope[]): BarangState => events.reduce(reduceBarang, {})
