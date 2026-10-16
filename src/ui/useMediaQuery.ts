import { useCallback, useSyncExternalStore } from 'react'

/** Whether a CSS media query matches right now (false where matchMedia does not exist, as in jsdom). For event handlers; components that render from it use useMediaQuery. */
export const matchesNow = (query: string): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(query).matches

/** A phone or tablet: no hover and a finger for a pointer. */
export const TOUCH_PRIMARY = '(hover: none) and (pointer: coarse)'

/**
 * Whether a CSS media query currently matches, following changes (rotation,
 * resizing). Where matchMedia does not exist (jsdom) it answers `fallback`.
 */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => {}
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return useSyncExternalStore(
    subscribe,
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
    () => fallback,
  )
}
