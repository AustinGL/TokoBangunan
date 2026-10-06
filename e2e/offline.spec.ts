import { test, expect } from '@playwright/test'

// The phase's headline claim: the app boots and navigates with the network
// disabled. The Vitest suite proves the component tree mounts when a mocked
// transport rejects; it proves nothing about the service worker, the
// precache manifest, or whether the shell is actually served from cache on
// a cold offline load. This is that proof, run against a real production
// build (see playwright.config.ts webServer: npm run build && preview).

async function activateServiceWorker(page: import('@playwright/test').Page) {
  // A newly installed worker is active before it controls the tab that
  // installed it. Wait for that state, reload once, then assert control.
  await page.waitForFunction(async () => {
    const registrations = await navigator.serviceWorker?.getRegistrations()
    return registrations?.some(registration => registration.active) ?? false
  }, { timeout: 15_000 })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, { timeout: 15_000 })
}

test.describe('offline boot', () => {
  test('the shell renders and navigates with the network disabled', async ({ page, context, isMobile }) => {
    // The "Beranda" page heading is used as the readiness signal rather than
    // the store name, which only renders in the desktop header (`hidden
    // md:flex`) and would be permanently hidden on the phone projects.
    const beranda = page.getByRole('heading', { level: 1 })

    // First load online so the service worker installs and precaches.
    await page.goto('/')
    await expect(beranda).toHaveText('Beranda')

    // A second navigation is required: on the very first visit the
    // installing worker does not control the page that triggered its own
    // install (there is no controller yet to take over from). Reloading
    // once while still online is what lets the now-active worker start
    // controlling requests, which is the real precondition an offline
    // reload depends on, not a timing workaround.
    await activateServiceWorker(page)
    await expect(beranda).toHaveText('Beranda')

    await context.setOffline(true)
    await page.reload()

    await expect(beranda).toHaveText('Beranda')

    // The sync indicator lives only inside TopNav (MASTER.md: "nav, never
    // the cart"), and TopNav is `hidden md:flex`. Phase 1's phone shell has
    // no sync-status UI yet, so the status region is legitimately absent
    // from the accessibility tree on phone, not a bug.
    if (!isMobile) {
      // The preview build has no .env, so it reports local-only; a configured
      // build with the network down would say "Belum tersinkron".
      await expect(page.getByRole('status')).toContainText(/Belum tersinkron|Belum masuk|Hanya di perangkat ini/)
    }

    // Navigation must still work: no network round trip is needed to move
    // between client-side routes. Both navs are always mounted (App.tsx
    // renders TopNav and BottomNav unconditionally so F2 survives at every
    // breakpoint), so two "Stok" links exist; click the first and assert on
    // the page heading, which is unique.
    await page.getByRole('link', { name: 'Stok' }).first().click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stok')

    await context.setOffline(false)
  })

  test('F2 opens Kasir while offline', async ({ page, context }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Beranda')
    await activateServiceWorker(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Beranda')

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Beranda')

    await page.keyboard.press('F2')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kasir')

    await context.setOffline(false)
  })
})
