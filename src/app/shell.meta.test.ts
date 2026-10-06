// @vitest-environment node
// Reads index.html, vite.config.ts and main.tsx from disk as plain text,
// the same pattern src/ui/tokens.test.ts already uses for tokens.css: these
// are wiring/config claims (a meta tag present, a glob pattern present), not
// runtime behaviour a component test could exercise.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const viteConfig = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8')
const mainTsx = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')
const robotsTxt = readFileSync(new URL('../../public/robots.txt', import.meta.url), 'utf8')

describe('index.html locks the colour scheme to light', () => {
  it('declares color-scheme: light, so native inputs never flip dark on an OS set to dark mode', () => {
    expect(indexHtml).toMatch(/<meta\s+name="color-scheme"\s+content="light"\s*\/?>/)
  })

  it('provides a useful Indonesian meta description', () => {
    expect(indexHtml).toMatch(/<meta\s+name="description"\s+content="[^"]+"\s*\/>/)
  })
})

describe('main.tsx loads the self-hosted variable font', () => {
  it('imports the Inter Variable package before mounting the app', () => {
    expect(mainTsx).toMatch(/@fontsource-variable\/inter/)
  })

  it('preloads the Latin font used by the first screen to avoid a metric-changing swap', () => {
    expect(indexHtml).toMatch(/<link\s+rel="preload"[^>]+inter-latin-wght-normal\.woff2[^>]+as="font"[^>]*>/)
  })
})

describe('vite.config.ts precaches the font and matches the new canvas colour', () => {
  it('adds woff2 to the workbox precache glob, so the font survives an offline reload', () => {
    // Default globPatterns is js/css/html only (verified against this
    // project's actual build output before writing this test): a hashed
    // .woff2 asset is fetched over the network on first paint and never
    // precached without this, so a hard-offline reload silently falls back
    // to the system font.
    const globPatternsBlock = viteConfig.match(/globPatterns:\s*\[[^\]]*\]/)
    expect(globPatternsBlock, 'no globPatterns array found in vite.config.ts').not.toBeNull()
    expect(globPatternsBlock![0]).toMatch(/woff2/)
  })

  it('retires the old orange and mint theme_colors for the neutral canvas', () => {
    expect(viteConfig).not.toMatch(/#1E7A55/)
    expect(viteConfig).not.toMatch(/#C43E17/)
    expect(viteConfig).toMatch(/theme_color:\s*'#F5F5F7'/)
  })

  it('defers service-worker registration so it cannot block first render', () => {
    expect(viteConfig).toMatch(/injectRegister:\s*'script-defer'/)
  })
})

describe('crawler metadata', () => {
  it('serves a valid robots.txt instead of the SPA fallback HTML', () => {
    expect(robotsTxt).toMatch(/^User-agent:\s*\*/m)
    expect(robotsTxt).toMatch(/^Disallow:\s*$/m)
  })
})
