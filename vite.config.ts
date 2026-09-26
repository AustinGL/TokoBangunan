/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Default globPatterns is js/css/html only. The self-hosted variable
        // font (@fontsource-variable/plus-jakarta-sans) ships as a hashed
        // .woff2 asset under dist/assets/, and without this it is fetched
        // over the network on first paint and never precached: a
        // hard-offline reload would fall back to the system font instead of
        // Plus Jakarta Sans Variable, silently. ico/png/svg cover the
        // manifest icon and favicon the same way.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Toko Bahan Bangunan',
        short_name: 'Toko',
        lang: 'id',
        start_url: '/',
        display: 'standalone',
        // Kaca Putih: cool white page background and cobalt brand,
        // replacing the old dark-mint theme. See src/ui/tokens.css's
        // --background and --primary.
        background_color: '#F4F6FB',
        theme_color: '#2451D6',
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
    // Vitest's default include pattern matches *.spec.ts, which collides
    // with e2e/*.spec.ts (Playwright tests, run only via `npm run test:e2e`,
    // never through Vitest). Exclude that directory explicitly rather than
    // relying on the two runners never seeing each other's files by luck.
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
})
