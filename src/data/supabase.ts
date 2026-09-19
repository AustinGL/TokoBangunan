import { createClient } from '@supabase/supabase-js'
import { db } from './db'
import { newEventId } from '../domain/ids'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } },
)

const DEVICE_KEY = 'deviceId'

// Concurrent first callers must share one in-flight lookup, otherwise each
// can race past the read-then-write below and mint a different id before
// either persists. Cleared once settled: later calls simply read the row
// that is now on disk, so nothing forever-cached goes stale.
let deviceIdPromise: Promise<string> | null = null

/** Stable per browser profile, so events can be traced to a device. */
export const getDeviceId = (): Promise<string> => {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        const row = await db.meta.get(DEVICE_KEY)
        if (row) return row.value as string
        const id = newEventId()
        await db.meta.put({ key: DEVICE_KEY, value: id })
        return id
      } finally {
        deviceIdPromise = null
      }
    })()
  }
  return deviceIdPromise
}
