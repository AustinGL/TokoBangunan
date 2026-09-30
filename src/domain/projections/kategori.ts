import type { EventEnvelope } from '../events'

export type Kategori = {
  id: string
  nama: string
  diarsipkan: boolean
  updatedAt: string
  updatedByEventId: string
}

export type KategoriState = Record<string, Kategori>

/** Same last-write-wins template as reduceBarang/reduceSuppliers. */
export function reduceKategori(state: KategoriState, event: EventEnvelope): KategoriState {
  if (event.type !== 'KategoriUpserted') return state
  const payload = event.payload as Omit<Kategori, 'updatedAt' | 'updatedByEventId'>
  const existing = state[payload.id]
  if (existing) {
    if (existing.updatedAt > event.recordedAt) return state
    if (existing.updatedAt === event.recordedAt && existing.updatedByEventId >= event.id) return state
  }
  return {
    ...state,
    [payload.id]: { ...payload, diarsipkan: payload.diarsipkan ?? false, updatedAt: event.recordedAt, updatedByEventId: event.id },
  }
}

export const projectKategori = (events: EventEnvelope[]): KategoriState => events.reduce(reduceKategori, {})
