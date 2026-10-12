import { describe, it, expect, vi } from 'vitest'
import { installStaleChunkReload } from './staleChunkReload'

function fakeWindow(storage: Pick<Storage, 'getItem' | 'setItem'> | 'throws') {
  const listeners: Record<string, () => void> = {}
  const reload = vi.fn()
  const win = {
    addEventListener: (type: string, fn: () => void) => { listeners[type] = fn },
    location: { reload },
    get sessionStorage() {
      if (storage === 'throws') throw new Error('blocked')
      return storage
    },
  } as unknown as Window
  return { win, reload, fire: () => listeners['vite:preloadError']() }
}

const memoryStorage = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } }
}

describe('installStaleChunkReload', () => {
  it('reloads once when a screen fails to load', () => {
    const { win, reload, fire } = fakeWindow(memoryStorage())
    installStaleChunkReload(win, () => 1_000_000)

    fire()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again within a minute, so a broken build cannot loop', () => {
    const { win, reload, fire } = fakeWindow(memoryStorage())
    let t = 1_000_000
    installStaleChunkReload(win, () => t)

    fire()
    t += 59_000
    fire()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads again for a later deploy, after the cooldown', () => {
    const { win, reload, fire } = fakeWindow(memoryStorage())
    let t = 1_000_000
    installStaleChunkReload(win, () => t)

    fire()
    t += 61_000
    fire()

    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload when it cannot remember that it already did', () => {
    const { win, reload, fire } = fakeWindow('throws')
    installStaleChunkReload(win)

    fire()

    expect(reload).not.toHaveBeenCalled()
  })
})
