import type { InboxRow } from './inbox'

/**
 * Snoozing a "Perlu diurus" row: hidden until a time, then it comes back by
 * itself. Pure, "now" is passed in. Where the snoozes are kept (this device
 * only) is data/tundaStore.ts.
 */

/** Inbox row key -> ISO time the row is hidden until. */
export type TundaMap = Record<string, string>

/** Local midnight at the start of tomorrow: "remind me tomorrow". */
export const tundaSampaiBesok = (now: Date): string =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).toISOString()

const masihBerlaku = (sampai: string, now: Date): boolean => {
  const t = Date.parse(sampai)
  return Number.isFinite(t) && t > now.getTime()
}

/** Splits the rows into those to show and those currently snoozed, keeping each side's order. */
export function pisahTunda(rows: InboxRow[], tunda: TundaMap, now: Date): { tampil: InboxRow[]; ditunda: InboxRow[] } {
  const tampil: InboxRow[] = []
  const ditunda: InboxRow[] = []
  for (const row of rows) {
    const sampai = tunda[row.key]
    if (sampai !== undefined && masihBerlaku(sampai, now)) ditunda.push(row)
    else tampil.push(row)
  }
  return { tampil, ditunda }
}

/** The snoozes that still hold: expired and malformed ones are dropped. */
export function tundaAktif(tunda: TundaMap, now: Date): TundaMap {
  return Object.fromEntries(Object.entries(tunda).filter(([, sampai]) => masihBerlaku(sampai, now)))
}
