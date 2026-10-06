import { renderHook } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

const original = window.matchMedia

afterEach(() => {
  window.matchMedia = original
})

describe('useMediaQuery', () => {
  it('answers the fallback where matchMedia does not exist (jsdom)', () => {
    // @ts-expect-error simulating an environment without matchMedia
    window.matchMedia = undefined
    expect(renderHook(() => useMediaQuery('(min-width: 768px)', true)).result.current).toBe(true)
    expect(renderHook(() => useMediaQuery('(min-width: 768px)', false)).result.current).toBe(false)
  })

  it('answers what matchMedia says, for the query it was given', () => {
    const seen: string[] = []
    window.matchMedia = vi.fn((query: string) => {
      seen.push(query)
      return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    }) as unknown as typeof window.matchMedia
    expect(renderHook(() => useMediaQuery('(min-width: 768px)', true)).result.current).toBe(false)
    expect(seen).toContain('(min-width: 768px)')
  })

  it('follows a change event', () => {
    let listener: () => void = () => {}
    let matches = false
    window.matchMedia = vi.fn(() => ({
      get matches() { return matches },
      addEventListener: (_: string, l: () => void) => { listener = l },
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
    const { result, rerender } = renderHook(() => useMediaQuery('(min-width: 768px)', false))
    expect(result.current).toBe(false)
    matches = true
    listener()
    rerender()
    expect(result.current).toBe(true)
  })
})
