import type { EventEnvelope } from './events'

/** When a customer was last reminded, and how many times. Derived from the log, nothing is stored. */
export type PengingatPelanggan = { terakhir: string; jumlah: number }

export function pengingatTerakhir(events: EventEnvelope[]): Record<string, PengingatPelanggan> {
  const seen = new Set<string>()
  const out: Record<string, PengingatPelanggan> = {}
  for (const e of events) {
    if (e.type !== 'ReminderSent' || seen.has(e.id)) continue
    seen.add(e.id)
    const { customerId } = e.payload as { customerId: string }
    const now = out[customerId]
    out[customerId] = {
      terakhir: now && now.terakhir > e.occurredAt ? now.terakhir : e.occurredAt,
      jumlah: (now?.jumlah ?? 0) + 1,
    }
  }
  return out
}
