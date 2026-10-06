import { tundaAktif, type TundaMap } from '../domain/tunda'

/**
 * Snoozed inbox rows live on this device only (localStorage). A snooze is a
 * convenience about what one screen shows, not business data, so it is not an
 * event and does not sync. Storage can be blocked (private mode), so every
 * access is guarded and a failure means "nothing snoozed".
 */
const KEY = 'toko-inbox-tunda'

/** The snoozes that still hold at `now`. */
export function bacaTunda(now: Date): TundaMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const strings = Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === 'string')
    return tundaAktif(Object.fromEntries(strings), now)
  } catch {
    return {}
  }
}

export function simpanTunda(tunda: TundaMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tunda))
  } catch {
    // Not saved: the row simply comes back on the next visit.
  }
}
