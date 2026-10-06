import type { EventEnvelope } from '../events'

export type Payment = {
  id: string
  saleId: string
  jumlah: number
  catatan?: string
  /** Business time of the payment. */
  occurredAt: string
  recordedAt: string
  deviceId: string
}

export type PaymentsState = Record<string, Payment>

/** One row per PaymentReceived, keyed by the event's own id; a replayed event is a no-op. */
export function reducePayments(state: PaymentsState, event: EventEnvelope): PaymentsState {
  if (event.type !== 'PaymentReceived') return state
  if (state[event.id]) return state
  const payload = event.payload as { saleId: string; jumlah: number; catatan?: string }
  return {
    ...state,
    [event.id]: {
      id: event.id,
      saleId: payload.saleId,
      jumlah: payload.jumlah,
      catatan: payload.catatan,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
      deviceId: event.deviceId,
    },
  }
}

export const projectPayments = (events: EventEnvelope[]): PaymentsState => events.reduce(reducePayments, {})
