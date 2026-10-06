import { defineConfig, devices } from '@playwright/test'

// Real-browser checks for the things jsdom structurally cannot see: computed
// layout, prefers-color-scheme, and whether pixels are actually readable.
// These are the gaps named in docs/superpowers/phase-1-handoff.md section 1.4
// and the theme bug found by inspection on 2026-09-21 (page background and
// text colour were never applied, so dark-theme --ink rendered on a
// browser-default white page; every component was individually correct, the
// document shell was not). Vitest's jsdom suite cannot catch that class of
// bug because jsdom never paints. This suite exists to close that gap.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // All four projects share one `npm run preview` server, and every worker is a node process
  // plus a Chromium. Measured on the dev machine (16 threads, 16 GB, a normal desktop session
  // open): with 4 workers the full suite failed every time in different places (page.goto and
  // `load` hanging for 45s, dialogs not opening, sizes read mid-animation) even with nothing
  // else running; with 2 workers it passed 167/167 on every run. So this is capped at 2. Raise it
  // on a bigger machine, not to make a slow run faster.
  workers: 2,
  // Booting the app in a fresh browser (service worker install, lazy route chunks) takes
  // several seconds, and the first test on each worker pays it while the other workers and
  // the preview server compete for the same machine. Under load that went past Playwright's
  // defaults (5s per expect, 30s per test), failing tests such as control-system with
  // "waiting for getByRole('heading', { level: 1 })" although nothing in the page was wrong.
  // These are ceilings, not delays: a wait returns as soon as the element appears. Do not
  // pass a smaller per-call timeout to wait for a page or heading; it overrides this.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    navigationTimeout: 45_000,
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'desktop-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    // devices['iPhone 13'] defaults to WebKit; only Chromium is installed
    // here, so the viewport/UA are taken from the preset but forced onto
    // Chromium rather than pulling in a second browser engine.
    {
      name: 'phone-light',
      use: { ...devices['iPhone 13'], defaultBrowserType: undefined, browserName: 'chromium', colorScheme: 'light' },
    },
    {
      name: 'phone-dark',
      use: { ...devices['iPhone 13'], defaultBrowserType: undefined, browserName: 'chromium', colorScheme: 'dark' },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
