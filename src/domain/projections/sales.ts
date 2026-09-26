import type { EventEnvelope } from '../events'

export type SaleLine = {
  itemId: string
  nama: string
  unit: string
  qty: number
  hargaSatuan: number
  subtotal: number
  /** Which purchase batch this line was sold from. Absent for the legacy ("Stok lama") pool, or a sale recorded before batches existed. */
  batchId?: string
  /** The ukuran's default harga jual at the moment this line was added, for the UI's "Harga diubah" flag. */
  hargaNormal?: number
}
export type Sale = {
  id: string                 // = the SaleRecorded event's own id
  lines: SaleLine[]
  metodeBayar: 'tunai'
  subtotal: number
  diskon: number
  total: number
  uangDiterima?: number
  customerId?: string
  deliveryIntent: 'dibawa'
  occurredAt: string          // business date; what the tanggal filter reads
  recordedAt: string
  deviceId: string
  status: 'aktif' | 'batal'
  voidedAt?: string
  voidedReason?: string
  /** Derived from lines at fold time, for Dexie's *itemIds multi-entry index (Transaksi's item filter). */
  itemIds: string[]
  /** Derived from lines at fold time, excluding lines with no batch, for Dexie's *batchIds multi-entry index (Transaksi's batch filter). */
  batchIds: string[]
}
export type SalesState = Record<string, Sale>

const dedupe = (values: string[]): string[] => Array.from(new Set(values))

/**
 * Unlike reduceItems/reduceStock (which key by the folding event's own
 * subject id), SaleVoided patches a row keyed by a FOREIGN reference
 * (payload.saleId), not the void event's own id. No (recordedAt, id)
 * tie-break is needed because a SaleVoided can only be authored, in this
 * phase's UI, after its SaleRecorded already exists -- ordering is
 * guaranteed by getAllEvents()'s causal sort (eventOrder.ts's
 * compareCausal), the same guarantee items.ts already leans on.
 */
export function reduceSales(state: SalesState, event: EventEnvelope): SalesState {
  if (event.type === 'SaleRecorded') {
    if (state[event.id]) return state  // idempotent: replayed insert is a no-op
    const payload = event.payload as Omit<Sale, 'id' | 'occurredAt' | 'recordedAt' | 'deviceId' | 'status' | 'voidedAt' | 'voidedReason' | 'itemIds' | 'batchIds'>
    const itemIds = dedupe(payload.lines.map(l => l.itemId))
    const batchIds = dedupe(payload.lines.map(l => l.batchId).filter((id): id is string => id !== undefined))
    return {
      ...state,
      [event.id]: {
        id: event.id, ...payload, occurredAt: event.occurredAt, recordedAt: event.recordedAt,
        deviceId: event.deviceId, status: 'aktif', itemIds, batchIds,
      },
    }
  }
  if (event.type === 'SaleVoided') {
    const payload = event.payload as { saleId: string; alasan: string }
    const existing = state[payload.saleId]
    if (!existing || existing.status === 'batal') return state
    return { ...state, [payload.saleId]: { ...existing, status: 'batal', voidedAt: event.recordedAt, voidedReason: payload.alasan } }
  }
  return state
}
export const projectSales = (events: EventEnvelope[]): SalesState => events.reduce(reduceSales, {})
