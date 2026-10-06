import { animasiSelesai } from './settle'
import { test, expect } from '@playwright/test'

// jsdom has no layout, so equal heights in a shared row can only be proven in a browser.
test.describe('control system', () => {
  test('Transaksi filter row: presets and date field are one height', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'size does not depend on colour scheme')
    await page.goto('/transaksi')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Transaksi')
    await animasiSelesai(page)
    const hariIni = await page.getByRole('button', { name: 'Hari ini' }).boundingBox()
    const kemarin = await page.getByRole('button', { name: 'Kemarin' }).boundingBox()
    const tanggal = await page.getByLabel('Tanggal').boundingBox()
    expect(Math.round(hariIni!.height)).toBe(44)
    expect(Math.round(kemarin!.height)).toBe(44)
    expect(Math.round(tanggal!.height)).toBe(44)
    // On a phone the date field wraps under the presets, so one row is only expected on desktop.
    if (testInfo.project.name.startsWith('desktop')) expect(Math.round(hariIni!.y)).toBe(Math.round(tanggal!.y))
  })

  test('Kamus toolbar: search, action button and archive pill are one height', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'size does not depend on colour scheme')
    await page.goto('/kamus')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kamus Barang')
    await animasiSelesai(page)
    const search = await page.getByRole('textbox', { name: 'Cari barang' }).boundingBox()
    const add = await page.getByRole('button', { name: '+ Barang baru' }).boundingBox()
    const arsip = await page.getByText('Tampilkan arsip').locator('xpath=ancestor-or-self::label').boundingBox()
    for (const box of [search, add, arsip]) expect(Math.round(box!.height)).toBe(44)
  })

  test('no visible control on any screen is shorter than 44px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'size does not depend on colour scheme')
    for (const route of ['/', '/transaksi', '/stok', '/kamus', '/supplier']) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await animasiSelesai(page)
      // Excluded: the sr-only skip link (1px until focused).
      const controls = 'button, a[href]:not([href="#konten"]), input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [role=combobox]'
      // 0.5px of slack: entrance animations (a few px of translate) can make a
      // 44px control measure 43.99 on a high-DPR phone. Real undersized controls
      // are 36px or smaller.
      const tooSmall = await page.$$eval(controls, els =>
        els.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && getComputedStyle(e).display !== 'inline' })
          .map(e => `${e.tagName} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().height)}px`))
      expect(tooSmall, `${route}: ${tooSmall.join(', ')}`).toEqual([])
    }
  })
})
