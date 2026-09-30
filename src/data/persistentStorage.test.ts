import { describe, it, expect, vi, afterEach } from 'vitest'
import { requestPersistentStorage } from './persistentStorage'

const setStorage = (storage: unknown) =>
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true })

afterEach(() => {
  // jsdom has no navigator.storage: put it back exactly as found.
  Reflect.deleteProperty(navigator, 'storage')
})

describe('requestPersistentStorage', () => {
  it('asks the browser not to evict this shop data, and reports what it answered', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist })

    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('does not ask again when storage is already persistent', async () => {
    const persist = vi.fn()
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist })

    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).not.toHaveBeenCalled()
  })

  it('reports false when the browser declines', async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) })

    expect(await requestPersistentStorage()).toBe(false)
  })

  it('reports false, without throwing, when the browser has no such API', async () => {
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('reports false, without throwing, when the request itself fails', async () => {
    setStorage({ persisted: vi.fn().mockRejectedValue(new Error('denied')), persist: vi.fn() })

    expect(await requestPersistentStorage()).toBe(false)
  })
})
