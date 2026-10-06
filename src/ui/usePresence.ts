import { useEffect, useState } from 'react'

/**
 * Whether the browser can play an exit animation at all. jsdom (and a person
 * who asked for reduced motion) get an immediate unmount instead of a ghost
 * that lingers for nothing.
 */
function canAnimate(): boolean {
  if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return false
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

/**
 * Keeps something mounted for `exitMs` after `open` turns false so its exit
 * animation can play. `mounted` is what to render; `closing` is true during
 * the exit, when the element must already be inert to assistive tech.
 */
export function usePresence(open: boolean, exitMs = 160): { mounted: boolean; closing: boolean } {
  const [prevOpen, setPrevOpen] = useState(open)
  const [lingering, setLingering] = useState(false)

  // Adjusting state during render (not in an effect) so the ghost exists in
  // the very commit where `open` flips, with no one-frame gap.
  if (open !== prevOpen) {
    setPrevOpen(open)
    setLingering(!open && canAnimate())
  }

  useEffect(() => {
    if (!lingering) return
    const timer = setTimeout(() => setLingering(false), exitMs)
    return () => clearTimeout(timer)
  }, [lingering, exitMs])

  return { mounted: open || lingering, closing: !open && lingering }
}
