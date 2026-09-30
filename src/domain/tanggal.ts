import type { Clock } from './clock'

/**
 * Converts a plain "yyyy-mm-dd" date (as a native <input type="date">
 * gives) to a Date at that calendar day's local noon - noon, not midnight,
 * so a DST transition or a UTC round-trip downstream can never shift the
 * calendar day the user actually picked. Deliberately built from local
 * Date fields (not parsed as an ISO string, which JS treats as UTC
 * midnight and can shift a day backward in negative-UTC-offset zones).
 */
export function dateAtLocalNoon(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/**
 * "yyyy-mm-dd" for today, per the given clock - the default value and the
 * max bound for a date input that must not accept a future date. Takes a
 * Clock (never reads the wall clock directly) so it stays testable with
 * fixedClock, matching every command in this codebase that needs "now".
 */
export function todayIsoDate(clock: Clock): string {
  const now = clock.now()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * "yyyy-mm-dd" for the calendar day `daysAgo` days before the clock's today
 * (0 = today, 1 = yesterday). Built from local date fields, never from a UTC
 * round-trip, so a day boundary in a UTC+7 shop is the shop's own midnight.
 */
export function isoDateDaysAgo(clock: Clock, daysAgo: number): string {
  const now = clock.now()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 12, 0, 0, 0)
  return todayIsoDate({ now: () => d })
}
