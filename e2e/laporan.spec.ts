import { test, expect, type Locator } from '@playwright/test'
import { contrastRatio, parseRgb, effectiveBackground } from './contrast'

// jsdom cannot see layout or paint. A fresh browser has no data, so this
// covers the empty Laporan: it renders, never overflows, its controls meet
// 44px and its text is readable in both colour schemes.

// The card grows in from 96% scale: measure only once that has finished, or sizes read a few percent short.
const selesaiAnimasi = (kartu: Locator) => kartu.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))

test.describe('laporan', () => {
  test('renders the empty state, does not overflow and the period controls are at least 44px tall', async ({ page }) => {
    await page.goto('/laporan')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Laporan')
    await expect(page.getByText('Belum ada transaksi atau pembelian stok pada periode ini.')).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `/laporan scrolls horizontally by ${overflow}px`).toBeLessThanOrEqual(0)

    for (const name of ['Hari ini', 'Bulan ini', 'Tahun ini']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox()
      expect(box?.height ?? 0, `${name} height`).toBeGreaterThanOrEqual(44)
    }
    const field = await page.getByRole('button', { name: /Rentang tanggal/ }).boundingBox()
    expect(field?.height ?? 0, 'range field height').toBeGreaterThanOrEqual(44)
  })

  test('the empty-state sentence is readable against its background', async ({ page }) => {
    await page.goto('/laporan')
    const selector = 'text="Belum ada transaksi atau pembelian stok pada periode ini."'
    const text = page.locator(selector)
    await expect(text).toBeVisible()
    const color = await text.evaluate(el => getComputedStyle(el).color)
    const bg = await effectiveBackground(page, selector)
    const ratio = contrastRatio(parseRgb(color), parseRgb(bg))
    expect(ratio, `text ${color} on ${bg}`).toBeGreaterThanOrEqual(4.5)
  })

  test('switching period keeps the screen working', async ({ page }) => {
    await page.goto('/laporan')
    await page.getByRole('button', { name: 'Hari ini', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Hari ini', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Laporan')
  })

  test('the range field opens a calendar with 44px days, fills itself, and does not overflow', async ({ page }, testInfo) => {
    await page.goto('/laporan')
    const field = page.getByRole('button', { name: /Rentang tanggal/ })
    await field.click()

    const kartu = page.getByRole('dialog', { name: 'Kalender Rentang tanggal' })
    await expect(kartu).toBeVisible()
    await selesaiAnimasi(kartu)
    const hari = kartu.locator('button[data-hari]:not([disabled])').first()
    const box = await hari.boundingBox()
    expect(box?.height ?? 0, `${testInfo.project.name} day height`).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${testInfo.project.name} overflow with the card open`).toBeLessThanOrEqual(0)

    await hari.click()
    await expect(kartu.getByText('Pilih tanggal akhir.')).toBeVisible()
    await hari.click()
    await expect(kartu).toBeHidden()
    await expect(field).toContainText('→')
  })

  test('a shortcut fills the range field', async ({ page }) => {
    await page.goto('/laporan')
    await page.getByRole('button', { name: 'Tahun ini', exact: true }).click()
    await expect(page.getByRole('button', { name: /Rentang tanggal/ })).toContainText(`1 Jan ${new Date().getFullYear()}`)
  })
})
