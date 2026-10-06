import { useSyncExternalStore } from 'react'

/**
 * True below Tailwind's lg breakpoint (1024px), where Kasir stacks its
 * layout and the cart moves into a bottom sheet behind a summary bar. Read
 * from matchMedia so it follows rotation and window resizing. Where
 * matchMedia does not exist (jsdom), it answers false: the desktop layout,
 * which is the one every component test exercises.
 */
const QUERY = '(max-width: 1023px)'

const subscribe = (onChange: () => void): (() => void) => {
  if (typeof window.matchMedia !== 'function') return () => {}
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

const getSnapshot = (): boolean =>
  typeof window.matchMedia === 'function' ? window.matchMedia(QUERY).matches : false

export function useIsCompact(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
