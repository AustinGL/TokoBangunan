import { test, expect, type Page } from '@playwright/test'
import { contrastRatio, parseRgb, effectiveBackground } from './contrast'

// Pelanggan and Biaya operasional in a real browser: empty states are readable,
// nothing overflows at phone width, controls are at least 44px, and an expense
// recorded on Biaya shows up on Laporan as laba bersih's cost line.

const overflowOf = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

async function seedPelanggan(page: Page) {
  await page.goto('/pelanggan')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pelanggan')
  await page.evaluate(async () => {
    const open = indexedDB.open('toko-bahan-bangunan')
    const idb: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const now = new Date().toISOString()
    const customer = (id: string, nama: string, telepon?: string) => ({
      id, nama, telepon, tier: 'eceran', termynHari: 30, updatedAt: now, updatedByEventId: 'seed',
    })
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(['customersProj'], 'readwrite')
      tx.objectStore('customersProj').put(customer('c-budi', 'Budi Santoso dengan Nama Sangat Panjang Sekali', '0812-555-0101'))
      tx.objectStore('customersProj').put(customer('c-sari', 'Sari'))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    idb.close()
  })
  await page.reload()
}

test.describe('pelanggan', () => {
  test('the empty state is readable and does not overflow', async ({ page }) => {
    await page.goto('/pelanggan')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pelanggan')
    const selector = 'text=/Belum ada pelanggan/'
    const text = page.locator(selector).first()
    await expect(text).toBeVisible()
    expect(await overflowOf(page)).toBeLessThanOrEqual(0)
    const ratio = contrastRatio(parseRgb(await text.evaluate(el => getComputedStyle(el).color)), parseRgb(await effectiveBackground(page, selector)))
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('the list never overflows, rows are 44px tall, search filters, and a customer opens', async ({ page }, testInfo) => {
    await seedPelanggan(page)
    const rows = page.getByRole('list', { name: 'Daftar pelanggan' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    expect(await overflowOf(page), `${testInfo.project.name} /pelanggan overflow`).toBeLessThanOrEqual(0)
    expect((await rows.first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    const cari = await page.getByRole('textbox', { name: 'Cari pelanggan' }).boundingBox()
    expect(cari?.height ?? 0).toBeGreaterThanOrEqual(44)

    await page.getByRole('textbox', { name: 'Cari pelanggan' }).fill('sar')
    await expect(rows).toHaveCount(1)
    await rows.first().getByRole('link').click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sari')
    await expect(page.getByText('Belum ada Bon.')).toBeVisible()
    expect(await overflowOf(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('biaya operasional', () => {
  test('the empty state is readable and does not overflow', async ({ page }) => {
    await page.goto('/biaya')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Biaya operasional')
    const selector = 'text=/Belum ada biaya/'
    const text = page.locator(selector).first()
    await expect(text).toBeVisible()
    expect(await overflowOf(page)).toBeLessThanOrEqual(0)
    const ratio = contrastRatio(parseRgb(await text.evaluate(el => getComputedStyle(el).color)), parseRgb(await effectiveBackground(page, selector)))
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('record an expense, correct it, and cancel it after a confirmation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await page.goto('/biaya')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Biaya operasional')

    await page.getByRole('button', { name: '+ Biaya baru' }).click()
    const sheet = page.getByRole('dialog', { name: 'Biaya baru' })
    await sheet.getByLabel('Jumlah').fill('350000')
    await sheet.getByRole('combobox', { name: 'Kategori' }).click()
    await page.getByRole('option', { name: 'Sewa' }).click()
    await sheet.getByLabel('Catatan').fill('Sewa gudang')
    for (const control of [sheet.getByLabel('Jumlah'), sheet.getByRole('combobox', { name: 'Kategori' }), sheet.getByLabel('Catatan')]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
    await sheet.getByRole('button', { name: 'Simpan biaya' }).click()
    await expect(sheet).toBeHidden()

    const list = page.getByRole('list', { name: 'Daftar biaya' })
    await expect(list).toContainText('Sewa gudang')
    await expect(list).toContainText('350.000')
    expect(await overflowOf(page)).toBeLessThanOrEqual(0)

    await page.getByRole('button', { name: 'Ubah biaya Sewa' }).click()
    const ubah = page.getByRole('dialog', { name: 'Ubah biaya' })
    await expect(ubah.getByLabel('Jumlah')).toHaveValue('350.000')
    await ubah.getByLabel('Jumlah').fill('400000')
    await ubah.getByRole('button', { name: 'Simpan biaya' }).click()
    await expect(ubah).toBeHidden()
    await expect(list).toContainText('400.000')
    await expect(list.getByRole('listitem').filter({ hasText: 'Dibatalkan' })).toHaveCount(1)

    await page.getByRole('button', { name: 'Batalkan biaya Sewa' }).click()
    await page.getByRole('button', { name: 'Ya, batalkan' }).click()
    await expect(list).toContainText('Dibatalkan')
  })

  test('an expense shows on Laporan as biaya operasional and a laba bersih section', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await page.goto('/biaya')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Biaya operasional')
    await page.getByRole('button', { name: '+ Biaya baru' }).click()
    const sheet = page.getByRole('dialog', { name: 'Biaya baru' })
    await sheet.getByLabel('Jumlah').fill('120000')
    await sheet.getByRole('combobox', { name: 'Kategori' }).click()
    await page.getByRole('option', { name: 'Listrik' }).click()
    await sheet.getByRole('button', { name: 'Simpan biaya' }).click()
    await expect(sheet).toBeHidden()

    await page.goto('/laporan')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Laporan')
    const rows = page.getByRole('list', { name: 'Ringkasan angka' })
    await expect(rows).toContainText('Biaya operasional')
    await expect(rows).toContainText('120.000')
    await expect(page.getByRole('list', { name: 'Biaya per kategori' })).toContainText('Listrik')
    expect(await overflowOf(page)).toBeLessThanOrEqual(0)
  })
})
