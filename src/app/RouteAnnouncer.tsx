import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { pageTitleFor } from './pageTitle'

/**
 * A single-page app never reloads, so on its own a screen reader hears
 * nothing when the "page" changes and every tab shows the same title. This
 * (a) sets document.title to the screen's own name, and (b) moves focus to
 * that screen's <h1> after a navigation, which is what makes assistive tech
 * read the new heading. (WCAG 2.4.2 Page Titled, 2.4.3 Focus Order.)
 *
 * It leaves focus alone when something inside the page already took it (the
 * Kasir search field autofocuses so a barcode scanner can type at once) and
 * on the very first load, where the browser has already announced the page.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)

  useEffect(() => {
    // Decided now, not inside the frame callback: a quick second navigation
    // cancels the frame, and the change must still count as a change.
    const navigated = previous.current !== pathname
    previous.current = pathname

    // Returns true once the screen's <h1> exists and has been announced.
    const announce = (): boolean => {
      const main = document.querySelector('main')
      const h1 = main?.querySelector('h1') ?? null
      if (!h1) return false
      document.title = pageTitleFor(h1.textContent)

      if (navigated) {
        const active = document.activeElement
        const somethingInPageHasFocus = active !== null && active !== document.body && main?.contains(active)
        if (!somethingInPageHasFocus) {
          h1.setAttribute('tabindex', '-1')
          h1.focus({ preventScroll: true })
        }
      }
      return true
    }

    // The heading may render a moment after the route (a screen that shows a
    // loading state first, like Barang detail), so look on the next frame and,
    // if it is not there yet, watch until it appears.
    let observer: MutationObserver | undefined
    const id = requestAnimationFrame(() => {
      if (announce()) return
      document.title = pageTitleFor(null)
      observer = new MutationObserver(() => {
        if (announce()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    return () => {
      cancelAnimationFrame(id)
      observer?.disconnect()
    }
  }, [pathname])

  return null
}
