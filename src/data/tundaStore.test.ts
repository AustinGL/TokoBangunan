import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { bacaTunda, simpanTunda } from './tundaStore'
import { tundaSampaiBesok } from '../domain/tunda'

const NOW = new Date(2026, 9, 5, 15, 30)
const KEY = 'toko-inbox-tunda'

// A hand-rolled Storage, like deviceId.test.ts: independent of how the host
// jsdom/Node pair wires up the real localStorage.
function createMockStorage() {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value) }),
    removeItem: vi.fn((key: string) => { store.delete(key) }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() { return store.size },
  }
}

let storage: ReturnType<typeof createMockStorage>

beforeEach(() => {
  storage = createMockStorage()
  vi.stubGlobal('localStorage', storage)
})
afterEach(() => vi.unstubAllGlobals())

describe('tundaStore', () => {
  it('reads nothing when nothing was saved', () => {
    expect(bacaTunda(NOW)).toEqual({})
  })

  it('round-trips a snooze', () => {
    const besok = tundaSampaiBesok(NOW)
    simpanTunda({ 'lewat-c1': besok })
    expect(bacaTunda(NOW)).toEqual({ 'lewat-c1': besok })
  })

  it('drops expired snoozes when reading', () => {
    simpanTunda({ lama: new Date(2026, 9, 4).toISOString(), baru: tundaSampaiBesok(NOW) })
    expect(Object.keys(bacaTunda(NOW))).toEqual(['baru'])
  })

  it('survives stored garbage: not JSON, not an object, non-string values', () => {
    storage.setItem(KEY, '{rusak')
    expect(bacaTunda(NOW)).toEqual({})
    storage.setItem(KEY, '[1,2]')
    expect(bacaTunda(NOW)).toEqual({})
    storage.setItem(KEY, JSON.stringify({ a: 5, b: tundaSampaiBesok(NOW) }))
    expect(bacaTunda(NOW)).toEqual({ b: tundaSampaiBesok(NOW) })
  })

  it('does not throw when storage is unavailable', () => {
    storage.getItem.mockImplementation(() => { throw new Error('blocked') })
    storage.setItem.mockImplementation(() => { throw new Error('blocked') })
    expect(bacaTunda(NOW)).toEqual({})
    expect(() => simpanTunda({ a: tundaSampaiBesok(NOW) })).not.toThrow()
  })
})
