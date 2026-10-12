const KEY = 'toko-chunk-reload-at'
const COOLDOWN_MS = 60_000

/**
 * After a deploy, a tab opened before it still holds the old page. Screens are
 * loaded on first visit, and the old build's file for a screen that tab has
 * not opened yet is gone, so opening it fails and (there is no error boundary)
 * blanks the app. Vite reports that as `vite:preloadError`.
 *
 * Reloading fetches the new build, which the service worker already has. It
 * loses nothing: the failure happens while navigating to a new screen, and the
 * cart lives only inside Kasir, which a navigation away from it already
 * discards.
 *
 * The cooldown stops a loop: if the reload does not fix it (the new build is
 * itself broken), the second failure is left to surface instead of reloading
 * forever. Without sessionStorage there is no way to tell, so it does not reload.
 */
export function installStaleChunkReload(win: Window = window, now: () => number = Date.now): void {
  win.addEventListener('vite:preloadError', () => {
    try {
      const last = Number(win.sessionStorage.getItem(KEY) ?? 0)
      if (now() - last < COOLDOWN_MS) return
      win.sessionStorage.setItem(KEY, String(now()))
    } catch {
      return
    }
    win.location.reload()
  })
}
