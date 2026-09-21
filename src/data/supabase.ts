import { createClient } from '@supabase/supabase-js'
import { db } from './db'
import { newEventId } from '../domain/ids'

/**
 * Cloud config must never be a boot dependency.
 *
 * createClient throws "supabaseUrl is required" when the env var is missing,
 * and this module is imported at the root of the app's import graph, so a
 * missing .env used to take the entire app (and the whole test suite, before a
 * single test ran) down at import time. That inverts the local-first premise:
 * the log, the projections and every screen work with no server at all, and
 * sync is the one thing that does not.
 *
 * Falling back to a syntactically valid placeholder keeps the module's shape
 * identical for every caller. Nothing is dialled at construction time, so an
 * unconfigured client costs nothing until a sync is attempted, at which point
 * it fails the same way being offline does and the UI already reports that
 * honestly as "Belum tersinkron".
 */
const PLACEHOLDER_URL = 'http://localhost:54321'
const PLACEHOLDER_ANON_KEY = 'anon-key-not-configured'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Running with a ' +
    'placeholder Supabase client: the app works offline, but sync will fail. ' +
    'Copy .env.example to .env to configure it.',
  )
}

export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || PLACEHOLDER_ANON_KEY,
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
