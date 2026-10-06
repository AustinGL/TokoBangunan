import { useEffect, useState } from 'react'
import { systemClock } from '../../domain/clock'
import { todayIsoDate } from '../../domain/tanggal'

// A moment past midnight, so the timer never lands a hair before the day changes.
const BUFFER_MS = 500

const msSampaiTengahMalam = (): number => {
  const now = systemClock.now()
  const tengahMalam = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return Math.max(BUFFER_MS, tengahMalam.getTime() - now.getTime() + BUFFER_MS)
}

/**
 * Today as a yyyy-mm-dd key, which changes by itself at local midnight. Screens
 * that work out "overdue", "this month" or "today" inside a live query pass it as
 * a dependency, so a tab left open overnight recomputes instead of showing
 * yesterday's statuses. A sleeping device suspends timers, so waking the tab
 * (visibilitychange) re-reads the clock too.
 */
export function useHariIni(): string {
  const [hariIni, setHariIni] = useState(() => todayIsoDate(systemClock))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const segarkan = () => {
      setHariIni(todayIsoDate(systemClock))
      clearTimeout(timer)
      timer = setTimeout(segarkan, msSampaiTengahMalam())
    }
    timer = setTimeout(segarkan, msSampaiTengahMalam())
    document.addEventListener('visibilitychange', segarkan)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', segarkan)
    }
  }, [])

  return hariIni
}
