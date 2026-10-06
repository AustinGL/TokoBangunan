import { test, expect, type Locator } from '@playwright/test'
import { contrastRatio, parseRgb } from './contrast'

// jsdom cannot see layout or paint. These check the calendar in a real browser:
// that its card stays inside the screen, its day text is readable, and that it
// works inside a modal Sheet (Tambah stok) without closing the Sheet.

// The card grows in from 96% scale: measure only once that has finished, or sizes read a few percent short.
const selesaiAnimasi = (kartu: Locator) => kartu.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))

test.describe('date picker', () => {
  test('a calendar opened in the Tambah stok sheet is usable and Escape closes only the calendar', async ({ page }, testInfo) => {
    await page.goto('/stok?tambah=1')
    const sheet = page.getByRole('dialog', { name: /Tambah stok/ })
    await expect(sheet).toBeVisible({ timeout: 25_000 })

    await sheet.getByRole('button', { name: /Tanggal beli/ }).click()
    const kartu = page.getByRole('dialog', { name: 'Kalender Tanggal beli' })
    await expect(kartu).toBeVisible()
    await selesaiAnimasi(kartu)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${testInfo.project.name} overflow`).toBeLessThanOrEqual(0)

    await page.keyboard.press('Escape')
    await expect(kartu).toBeHidden()
    await expect(sheet).toBeVisible()

    await sheet.getByRole('button', { name: /Tanggal beli/ }).click()
    await kartu.locator('button[data-hari]:not([disabled])').first().click()
    await expect(kartu).toBeHidden()
    await expect(sheet.getByRole('button', { name: /Tanggal beli/ })).not.toContainText('Pilih tanggal')
  })

  test('a calendar opened inside a sheet is scrolled fully into view', async ({ page }, testInfo) => {
    await page.goto('/stok?tambah=1')
    const sheet = page.getByRole('dialog', { name: /Tambah stok/ })
    await expect(sheet).toBeVisible({ timeout: 25_000 })

    await sheet.getByRole('button', { name: /Tanggal beli/ }).click()
    const kartu = page.getByRole('dialog', { name: 'Kalender Tanggal beli' })
    await expect(kartu).toBeVisible()
    await selesaiAnimasi(kartu)

    const tinggi = page.viewportSize()!.height
    // The scroll runs once the entry animation has finished: poll until it has settled.
    await expect.poll(async () => {
      const box = await kartu.boundingBox()
      return box ? Math.round(box.y + box.height) : Infinity
    }, { message: `${testInfo.project.name}: bottom of the card against a ${tinggi}px viewport`, timeout: 5_000 }).toBeLessThanOrEqual(tinggi + 1)
  })

  test('day numbers are readable against the card', async ({ page }) => {
    await page.goto('/laporan')
    await page.getByRole('button', { name: /Rentang tanggal/ }).click()
    const angka = page.locator('button[data-hari]:not([disabled])').nth(3).locator('span')
    await expect(angka).toBeVisible()
    const color = await angka.evaluate(el => getComputedStyle(el).color)
    const bg = await angka.evaluate(el => {
      let n: Element | null = el
      while (n) {
        const c = getComputedStyle(n).backgroundColor
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c
        n = n.parentElement
      }
      return 'rgb(255, 255, 255)'
    })
    expect(contrastRatio(parseRgb(color), parseRgb(bg)), `text ${color} on ${bg}`).toBeGreaterThanOrEqual(4.5)
  })

  test('the Transaksi date filter opens a calendar that stays on screen', async ({ page }, testInfo) => {
    await page.goto('/transaksi')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 25_000 })
    await page.getByRole('button', { name: /^Tanggal/ }).click()
    const kartu = page.getByRole('dialog', { name: 'Kalender Tanggal' })
    await expect(kartu).toBeVisible()
    await selesaiAnimasi(kartu)
    const box = await kartu.boundingBox()
    const viewport = page.viewportSize()!
    expect(box!.x, `${testInfo.project.name} card left edge`).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width, `${testInfo.project.name} card right edge`).toBeLessThanOrEqual(viewport.width + 1)
  })

  test('the two-month range card stays on screen at tablet widths, and its page buttons keep working from the keyboard', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('phone'), 'a phone shows one month; widths here are tablet and laptop')
    for (const width of [800, 900, 1000]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/laporan')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 25_000 })
      await page.getByRole('button', { name: /Rentang tanggal/ }).click()
      const kartu = page.getByRole('dialog', { name: 'Kalender Rentang tanggal' })
      await expect(kartu).toBeVisible()
      await selesaiAnimasi(kartu)
      const box = await kartu.boundingBox()
      expect(box!.x, `width ${width}: card left edge`).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width, `width ${width}: card right edge`).toBeLessThanOrEqual(width)

      const heading = kartu.getByRole('heading').first()
      const before = await heading.textContent()
      await kartu.getByRole('button', { name: 'Bulan sebelumnya' }).click()
      await kartu.getByRole('button', { name: 'Bulan sebelumnya' }).press('Enter')
      expect(await heading.textContent(), `width ${width}: two page turns`).not.toBe(before)
    }
  })
})
