import { test, expect, type Page } from '@playwright/test'

// Real-browser checks for the list screens: things jsdom cannot see (layout
// width, the dropdown panel painting and flipping). Barang are created through
// Kamus Barang, not the inline "Barang baru" in Tambah stok (that path nests a
// <form> inside a <form> and navigates in Chrome: a separate, known issue).

const LONG_NAME = 'Semen Portland Composite Tiga Roda Kemasan Sak Kertas Anti Lembab Edisi Khusus Proyek'

async function createBarangViaKamus(page: Page, opts: { nama: string; kategori: string; ukuran: string }) {
  await page.goto('/kamus')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kamus Barang', { timeout: 10_000 })
  await page.getByRole('button', { name: '+ Barang baru' }).click()

  const barang = page.getByRole('dialog', { name: 'Barang baru' })
  await barang.getByLabel('Nama barang').fill(opts.nama)
  await barang.getByLabel('Kategori').fill(opts.kategori)
  await barang.getByRole('button', { name: 'Simpan' }).click()

  const ukuran = page.getByRole('dialog', { name: 'Ukuran baru' })
  await ukuran.getByLabel('Ukuran').fill(opts.ukuran)
  await ukuran.getByLabel('Harga eceran').fill('65000')
  await ukuran.getByLabel('Stok minimum').fill('10')
  await ukuran.getByRole('button', { name: 'Simpan' }).click()
  await expect(ukuran).toBeHidden()
}

test.describe('list pages', () => {
  test('never overflow horizontally, even with a very long barang name', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'layout does not depend on colour scheme')
    await createBarangViaKamus(page, { nama: LONG_NAME, kategori: 'Semen', ukuran: '50 kg' })

    for (const route of ['/stok', '/kamus', '/supplier', '/transaksi']) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${route} scrolls horizontally by ${overflow}px`).toBeLessThanOrEqual(0)
    }
  })

  test('the Kategori dropdown on Stok opens, filters the list and resets', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await createBarangViaKamus(page, { nama: 'E2E Semen', kategori: 'Semen', ukuran: '50 kg' })
    await createBarangViaKamus(page, { nama: 'E2E Cat', kategori: 'Cat', ukuran: '5 kg' })

    await page.goto('/stok')
    await expect(page.getByRole('link', { name: /E2E Semen/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /E2E Cat/ })).toBeVisible()

    await page.getByRole('combobox', { name: /kategori/i }).click()
    await page.getByRole('option', { name: 'Cat', exact: true }).click()
    await expect(page.getByRole('link', { name: /E2E Semen/ })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /E2E Cat/ })).toBeVisible()

    await page.getByRole('button', { name: 'Reset filter' }).click()
    await expect(page.getByRole('link', { name: /E2E Semen/ })).toBeVisible()
  })

  test('the Habis tile filters Stok and every new control is at least 44px tall', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'size does not depend on colour scheme')
    await createBarangViaKamus(page, { nama: 'E2E Habis', kategori: 'Semen', ukuran: '50 kg' })

    await page.goto('/stok')
    await page.getByRole('button', { name: 'Habis: 1' }).click()
    await expect(page.getByRole('link', { name: /E2E Habis/ })).toBeVisible()

    for (const control of [
      page.getByRole('button', { name: /^Semua barang:/ }),
      page.getByRole('button', { name: /^Menipis:/ }),
      page.getByRole('button', { name: /^Habis:/ }),
      page.getByRole('combobox', { name: /kategori/i }),
      page.getByLabel('Cari barang'),
    ]) {
      const box = await control.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(43.5)
    }
  })
})
