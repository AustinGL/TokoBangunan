import type { EventEnvelope } from '../events'

export type Customer = {
  id: string
  nama: string
  telepon?: string
  alamat?: string
  tier: 'eceran' | 'grosir'
  /** Default days until a Bon is due. */
  termynHari: number
  updatedAt: string
  updatedByEventId: string
}

export type CustomersState = Record<string, Customer>

/**
 * Same last-write-wins template as reduceSuppliers. `?? default` closes the
 * gap for a raw payload replayed from the log that predates a defaulted key.
 */
export function reduceCustomers(state: CustomersState, event: EventEnvelope): CustomersState {
  if (event.type !== 'CustomerUpserted') return state
  const payload = event.payload as Omit<Customer, 'updatedAt' | 'updatedByEventId'>
  const existing = state[payload.id]
  if (existing) {
    if (existing.updatedAt > event.recordedAt) return state
    if (existing.updatedAt === event.recordedAt && existing.updatedByEventId >= event.id) return state
  }
  return {
    ...state,
    [payload.id]: {
      ...payload,
      tier: payload.tier ?? 'eceran',
      termynHari: payload.termynHari ?? 30,
      updatedAt: event.recordedAt,
      updatedByEventId: event.id,
    },
  }
}

export const projectCustomers = (events: EventEnvelope[]): CustomersState => events.reduce(reduceCustomers, {})
