import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useHariIni } from './useHariIni'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useHariIni', () => {
  it('is today as a yyyy-mm-dd key', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 15, 30))
    expect(renderHook(() => useHariIni()).result.current).toBe('2026-10-05')
  })

  it('moves to the next day by itself at local midnight, with the tab left open', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59, 30))
    const { result } = renderHook(() => useHariIni())
    expect(result.current).toBe('2026-10-05')

    act(() => { vi.advanceTimersByTime(29_000) })
    expect(result.current).toBe('2026-10-05')
    act(() => { vi.advanceTimersByTime(2_000) })
    expect(result.current).toBe('2026-10-06')
  })

  it('keeps counting: a second midnight later moves it again', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59, 59))
    const { result } = renderHook(() => useHariIni())
    act(() => { vi.advanceTimersByTime(2_000) })
    expect(result.current).toBe('2026-10-06')
    act(() => { vi.advanceTimersByTime(24 * 60 * 60 * 1000) })
    expect(result.current).toBe('2026-10-07')
  })

  it('catches up when the tab wakes after a long sleep, which suspended its timer', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 22, 0))
    const { result } = renderHook(() => useHariIni())
    // The clock jumps (laptop slept overnight) without the timer firing.
    vi.setSystemTime(new Date(2026, 9, 6, 8, 0))
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current).toBe('2026-10-06')
  })

  it('stops its timer and listener when unmounted', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 23, 59, 30))
    const remove = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useHariIni())
    unmount()
    expect(remove.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
