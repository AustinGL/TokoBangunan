import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db'
import { getDeviceId } from './supabase'

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
})
