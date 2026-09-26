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

describe('index.html locks the colour scheme to light', () => {
  it('declares color-scheme: light, so native inputs never flip dark on an OS set to dark mode', () => {
    expect(indexHtml).toMatch(/<meta\s+name="color-scheme"\s+content="light"\s*\/?>/)
  })
})

describe('main.tsx loads the self-hosted variable font', () => {
  it('imports the Plus Jakarta Sans Variable package before mounting the app', () => {
    expect(mainTsx).toMatch(/@fontsource-variable\/plus-jakarta-sans/)
  })
})

describe('vite.config.ts precaches the font and matches the new brand colour', () => {
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

  it('retires the old mint theme_color for the new cobalt primary', () => {
    expect(viteConfig).not.toMatch(/#1E7A55/)
    expect(viteConfig).toMatch(/theme_color:\s*'#2451D6'/)
  })
})
