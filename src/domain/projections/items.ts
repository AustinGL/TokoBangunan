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
  /** recordedAt of the write that produced this state, for last-write-wins. */
  updatedAt: string
}

export type ItemsState = Record<string, Item>

export function reduceItems(state: ItemsState, event: EventEnvelope): ItemsState {
  if (event.type !== 'ItemUpserted') return state
  const payload = event.payload as Omit<Item, 'updatedAt'>
  const existing = state[payload.id]
  if (existing && existing.updatedAt >= event.recordedAt) return state
  return { ...state, [payload.id]: { ...payload, updatedAt: event.recordedAt } }
}

export const projectItems = (events: EventEnvelope[]): ItemsState =>
  events.reduce(reduceItems, {})
