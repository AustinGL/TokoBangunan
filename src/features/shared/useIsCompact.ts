import { useMediaQuery } from '../../ui/useMediaQuery'

/**
 * True below Tailwind's lg breakpoint (1024px), where Kasir stacks its
 * layout and the cart moves into a bottom sheet behind a summary bar. Follows
 * rotation and window resizing. Where matchMedia does not exist (jsdom), it
 * answers false: the desktop layout, which is the one every component test
 * exercises.
 */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 1023px)', false)
}
