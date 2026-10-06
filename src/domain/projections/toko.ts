import type { EventEnvelope } from '../events'

/** The shop's own details. One row, id 'toko'. Only the name exists so far. */
export type Toko = {
  id: 'toko'
  nama: string
  updatedAt: string
  updatedByEventId: string
}

export type TokoState = Record<string, Toko>

/** Same last-write-wins template as reduceCustomers and reduceSuppliers. */
export function reduceToko(state: TokoState, event: EventEnvelope): TokoState {
  if (event.type !== 'TokoDiatur') return state
  const payload = event.payload as { nama: string }
  const existing = state.toko
  if (existing) {
    if (existing.updatedAt > event.recordedAt) return state
    if (existing.updatedAt === event.recordedAt && existing.updatedByEventId >= event.id) return state
  }
  return { ...state, toko: { id: 'toko', nama: payload.nama, updatedAt: event.recordedAt, updatedByEventId: event.id } }
}

export const projectToko = (events: EventEnvelope[]): TokoState => events.reduce(reduceToko, {})
