/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is non-critical startup work. Deferring this tiny script
      // keeps it out of the first-render dependency chain while preserving the
      // same generated service worker and offline behavior.
      injectRegister: 'script-defer',
      workbox: {
        // A freshly installed worker should control the open app immediately.
        // This makes an offline reload dependable instead of waiting for a
        // later navigation lifecycle.
        clientsClaim: true,
        skipWaiting: true,
        // Default globPatterns is js/css/html only. The self-hosted variable
        // font (@fontsource-variable/inter) ships as a hashed
        // .woff2 asset under dist/assets/, and without this it is fetched
        // over the network on first paint and never precached: a
        // hard-offline reload would fall back to the system font instead of
        // Inter Variable, silently. ico/png/svg cover the
        // manifest icon and favicon the same way.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Toko Bahan Bangunan',
        short_name: 'Toko',
        lang: 'id',
        start_url: '/',
        display: 'standalone',
        // Toko Clarity: neutral off-white page background and the blue accent,
        // See src/ui/tokens.css's
        // --background and --primary.
        background_color: '#F5F5F7',
        theme_color: '#F5F5F7',
        icons: [
          // No branded PNG art exists yet (public/ only has favicon.svg).
          // Point at the asset that actually exists rather than referencing
          // /icon-192.png and /icon-512.png, which 404. Real PNG icons are a
          // deliverable for the repository owner.
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // A test that first-loads a lazy route (a dynamic import vite must transform) can take
    // several seconds when the machine is busy. 5s (the default) cut such tests off at random.
    // Waits inside a test are capped lower (src/test-setup.ts) so a missing element still
    // fails with its own message, not a bare timeout.
    testTimeout: 20_000,
    // Vitest's default include pattern matches *.spec.ts, which collides
    // with e2e/*.spec.ts (Playwright tests, run only via `npm run test:e2e`,
    // never through Vitest). Exclude that directory explicitly rather than
    // relying on the two runners never seeing each other's files by luck.
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
})
