import { createClient } from '@supabase/supabase-js'
import { db } from './db'
import { newEventId } from '../domain/ids'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } },
)

const DEVICE_KEY = 'deviceId'

/** Stable per browser profile, so events can be traced to a device. */
export const getDeviceId = async (): Promise<string> => {
  const row = await db.meta.get(DEVICE_KEY)
  if (row) return row.value as string
  const id = newEventId()
  await db.meta.put({ key: DEVICE_KEY, value: id })
  return id
}
