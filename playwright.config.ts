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
  // All four projects share one `npm run preview` server. High worker counts
  // were observed to starve page.goto() under contention (30s timeouts that
  // passed instantly in isolation), so this is capped rather than left at
  // Playwright's per-core default.
  workers: 4,
  reporter: [['list']],
  use: {
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
