import type { EventEnvelope } from '../events'

export type Supplier = {
  id: string
  nama: string
  telepon?: string
  alamat?: string
  kontak?: string
  catatan?: string
  perluDilengkapi: boolean
  updatedAt: string
  updatedByEventId: string
}

export type SuppliersState = Record<string, Supplier>

/**
 * Same last-write-wins template as reduceBarang/reduceItems. Unlike
 * BarangUpserted, SupplierUpserted already existed before this event
 * carried perluDilengkapi (Phase 1), so a raw payload replayed from the log
 * can genuinely lack that key even though the type says boolean - `?? false`
 * closes that gap here rather than pushing it onto every consumer.
 */
export function reduceSuppliers(state: SuppliersState, event: EventEnvelope): SuppliersState {
  if (event.type !== 'SupplierUpserted') return state
  const payload = event.payload as Omit<Supplier, 'updatedAt' | 'updatedByEventId'>
  const existing = state[payload.id]
  if (existing) {
    if (existing.updatedAt > event.recordedAt) return state
    if (existing.updatedAt === event.recordedAt && existing.updatedByEventId >= event.id) return state
  }
  return {
    ...state,
    [payload.id]: {
      ...payload,
      perluDilengkapi: payload.perluDilengkapi ?? false,
      updatedAt: event.recordedAt,
      updatedByEventId: event.id,
    },
  }
}

export const projectSuppliers = (events: EventEnvelope[]): SuppliersState => events.reduce(reduceSuppliers, {})
