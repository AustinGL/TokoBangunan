import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const DEVICE_ID_KEY = 'toko-device-id'

/**
 * A hand-rolled Storage stub, installed via vi.stubGlobal, rather than
 * relying on the test environment's own window.localStorage: this keeps the
 * suite deterministic (no dependency on how the host jsdom/Node combination
 * happens to wire up the real Storage implementation) and lets the
 * storage-unavailable test simulate a throwing getItem precisely.
 */
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

let mockStorage: ReturnType<typeof createMockStorage>

beforeEach(() => {
  mockStorage = createMockStorage()
  vi.stubGlobal('localStorage', mockStorage)
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getDeviceId', () => {
  it('generates and persists an id on first call', async () => {
    const { getDeviceId } = await import('./deviceId')

    const id = getDeviceId()

    expect(id).toBeTruthy()
    expect(mockStorage.getItem(DEVICE_ID_KEY)).toBe(id)
  })

  it('returns the same cached id on a second call, without re-reading localStorage', async () => {
    const { getDeviceId } = await import('./deviceId')
    const first = getDeviceId()
    mockStorage.getItem.mockClear()

    const second = getDeviceId()

    expect(second).toBe(first)
    expect(mockStorage.getItem).not.toHaveBeenCalled()
  })

  it('returns the already-persisted id on a fresh module load, instead of minting a new one', async () => {
    mockStorage.setItem(DEVICE_ID_KEY, 'pre-seeded-device-id')
    mockStorage.setItem.mockClear()

    const { getDeviceId } = await import('./deviceId')

    expect(getDeviceId()).toBe('pre-seeded-device-id')
    // No second id was minted or persisted over the pre-seeded value.
    expect(mockStorage.setItem).not.toHaveBeenCalled()
  })

  it('falls back to a session-only id when storage is unavailable, instead of throwing', async () => {
    mockStorage.getItem.mockImplementation(() => { throw new Error('storage disabled') })

    const { getDeviceId } = await import('./deviceId')

    const id = getDeviceId()
    expect(id).toBeTruthy()
    // Still memoized within the session even though nothing was persisted.
    expect(getDeviceId()).toBe(id)
  })
})
