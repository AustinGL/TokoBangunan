import type { EventEnvelope, KategoriBiaya } from '../events'

export type Expense = {
  id: string
  jumlah: number
  kategori: KategoriBiaya
  catatan?: string
  /** Business time: the day the money went out. */
  occurredAt: string
  recordedAt: string
  deviceId: string
  status: 'aktif' | 'batal'
  voidedAt?: string
}

export type ExpensesState = Record<string, Expense>

/**
 * One row per ExpenseRecorded, keyed by the event's own id (a replayed event
 * is a no-op). ExpenseVoided patches the row it names, like SaleVoided: the
 * causal order of getAllEvents() guarantees the record comes first, and a
 * void for an unknown or already voided expense is ignored.
 */
export function reduceExpenses(state: ExpensesState, event: EventEnvelope): ExpensesState {
  if (event.type === 'ExpenseRecorded') {
    if (state[event.id]) return state
    const payload = event.payload as { jumlah: number; kategori: KategoriBiaya; catatan?: string }
    return {
      ...state,
      [event.id]: {
        id: event.id, jumlah: payload.jumlah, kategori: payload.kategori, catatan: payload.catatan,
        occurredAt: event.occurredAt, recordedAt: event.recordedAt, deviceId: event.deviceId, status: 'aktif',
      },
    }
  }
  if (event.type === 'ExpenseVoided') {
    const { expenseId } = event.payload as { expenseId: string }
    const existing = state[expenseId]
    if (!existing || existing.status === 'batal') return state
    return { ...state, [expenseId]: { ...existing, status: 'batal', voidedAt: event.recordedAt } }
  }
  return state
}

export const projectExpenses = (events: EventEnvelope[]): ExpensesState => events.reduce(reduceExpenses, {})
