import { animasiSelesai } from './settle'
import { test, expect, type Page } from '@playwright/test'

// Four payment methods (Tunai, Transfer, QRIS, Bon) and a changeable sale date
// have to fit the cart panel at phone width with 44px touch targets. jsdom
// cannot measure that, so this puts a real item in a real cart and measures.

async function cartWithOneItem(page: Page, nama: string) {
  await page.goto('/kasir')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kasir')
  await page.getByLabel('Cari barang').fill(nama)
  await page.getByRole('button', { name: 'Tambah barang baru' }).click()
  await page.getByRole('button', { name: 'Tambah barang baru' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click()
  const ukuran = page.getByRole('dialog')
  await ukuran.getByLabel('Ukuran').fill('sak')
  await ukuran.getByLabel('Harga eceran').fill('52000')
  await ukuran.getByLabel('Stok minimum').fill('5')
  await ukuran.getByRole('button', { name: 'Simpan' }).click()
}

const overflowOf = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('kasir: metode bayar dan tanggal', () => {
  test('the four methods and the date row fit, with 44px targets', async ({ page }, testInfo) => {
    await cartWithOneItem(page, 'Semen Uji')
    if (testInfo.project.name.startsWith('phone')) await page.getByRole('button', { name: /Lihat keranjang/ }).click()

    const group = page.getByRole('group', { name: 'Metode bayar' })
    await expect(group.getByRole('button')).toHaveText(['Tunai', 'Transfer', 'QRIS', 'Bon'])
    await animasiSelesai(page)
    for (const button of await group.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box?.height ?? 0, `${testInfo.project.name} method button height`).toBeGreaterThanOrEqual(44)
    }
    // Neither a label nor the group may spill past the panel.
    const groupBox = await group.boundingBox()
    const viewport = page.viewportSize()
    expect((groupBox?.x ?? 0) + (groupBox?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0)
    for (const button of await group.getByRole('button').all()) {
      expect(await button.evaluate(el => el.scrollWidth - el.clientWidth), 'a method label is clipped').toBeLessThanOrEqual(0)
    }

    await expect(page.getByText('Tanggal transaksi: hari ini')).toBeVisible()
    const ubah = await page.getByRole('button', { name: 'Ubah tanggal' }).boundingBox()
    expect(ubah?.height ?? 0, `${testInfo.project.name} Ubah tanggal height`).toBeGreaterThanOrEqual(44)
    expect(await overflowOf(page), `${testInfo.project.name} /kasir overflow`).toBeLessThanOrEqual(0)
  })

  test('Transfer is saved as paid in full, with no cash field', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await cartWithOneItem(page, 'Pasir Uji')
    if (testInfo.project.name.startsWith('phone')) await page.getByRole('button', { name: /Lihat keranjang/ }).click()

    await page.getByRole('group', { name: 'Metode bayar' }).getByRole('button', { name: 'Transfer' }).click()
    await expect(page.getByLabel('Uang diterima')).toHaveCount(0)
    await expect(page.getByText('Dibayar penuh lewat Transfer.')).toBeVisible()
    await page.getByRole('button', { name: 'Simpan transaksi' }).click()
    await expect(page.getByText('Transaksi tersimpan')).toBeVisible()
    await expect(page.getByText('Dibayar lewat Transfer')).toBeVisible()
  })
})
