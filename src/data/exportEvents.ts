import type { EventEnvelope } from '../domain/events'
import type { QuarantineRow } from './db'
import { getDeviceId } from './deviceId'
import { getAllEvents, getQuarantined } from './eventStore'

/**
 * A full copy of this device's event log, for the owner to keep. Every
 * projection (stok, penjualan, piutang, ...) is rebuilt from the events, so
 * the log is the whole shop. Unsynced events live in the same table (the
 * outbox is only an index over them), so one read covers both.
 *
 * Records that arrived from sync but this version could not parse are kept
 * verbatim under `quarantine`, matching the append-only rule in db.ts: nothing
 * is dropped from a backup either.
 */
export type BackupFile = {
  format: 'toko-bangunan-events'
  version: 1
  exportedAt: string
  deviceId: string
  events: EventEnvelope[]
  quarantine: QuarantineRow[]
}

export async function buildBackup(now: Date = new Date()): Promise<BackupFile> {
  const [events, quarantine] = await Promise.all([getAllEvents(), getQuarantined()])
  return {
    format: 'toko-bangunan-events',
    version: 1,
    exportedAt: now.toISOString(),
    deviceId: getDeviceId(),
    events,
    quarantine,
  }
}

/** Local calendar date, so a download at 23:30 in Jakarta is not named for tomorrow. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `toko-cadangan-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

/** Builds the backup and hands it to the browser as a file download. Returns how many events it holds. */
export async function downloadBackup(now: Date = new Date()): Promise<number> {
  const backup = await buildBackup(now)
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName(now)
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // The click has already started the download; release the blob afterwards.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return backup.events.length
}
