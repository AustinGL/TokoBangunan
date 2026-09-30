import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { getDeviceId, supabase } from './supabase'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('getDeviceId', () => {
  it('generates an id and persists it in the meta table', async () => {
    const id = await getDeviceId()
    const row = await db.meta.get('deviceId')
    expect(row?.value).toBe(id)
  })

  it('returns the same id on every subsequent call', async () => {
    const first = await getDeviceId()
    const second = await getDeviceId()
    const third = await getDeviceId()
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('resolves concurrent first calls to the same id, with only one row persisted', async () => {
    const [a, b, c] = await Promise.all([getDeviceId(), getDeviceId(), getDeviceId()])
    expect(b).toBe(a)
    expect(c).toBe(a)
    expect(await db.meta.count()).toBe(1)
  })
})

describe('supabase client', () => {
  it('does not sign in from tokens in the URL: the app has no magic-link or OAuth flow, so that path stays closed', () => {
    expect(Reflect.get(supabase.auth, 'detectSessionInUrl')).toBe(false)
  })
})
