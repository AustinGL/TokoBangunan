import { test, expect } from '@playwright/test'

test.describe('kategori master', () => {
  test('add a kategori from Barang baru, then see it on the barang and on the Kategori screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await page.goto('/kamus')
    await page.getByRole('button', { name: '+ Barang baru' }).click()
    const barang = page.getByRole('dialog', { name: 'Barang baru' })
    await barang.getByLabel('Nama barang').fill('E2E Palu')

    await barang.getByRole('button', { name: 'Tambah kategori baru' }).click()
    const kategori = page.getByRole('dialog', { name: 'Kategori baru' })
    await kategori.getByLabel(/Nama kategori/).fill('Perkakas E2E')
    await kategori.getByRole('button', { name: 'Simpan' }).click()
    await expect(kategori).toBeHidden()
    await expect(barang.getByRole('combobox', { name: 'Kategori' })).toHaveValue('Perkakas E2E')

    await barang.getByRole('button', { name: 'Simpan' }).click()
    const ukuran = page.getByRole('dialog', { name: 'Ukuran baru' })
    await ukuran.getByLabel('Ukuran').fill('1 pcs')
    await ukuran.getByLabel('Harga eceran').fill('50000')
    await ukuran.getByLabel('Stok minimum').fill('1')
    await ukuran.getByRole('button', { name: 'Simpan' }).click()
    await expect(ukuran).toBeHidden()

    await page.goto('/kategori')
    await expect(page.getByRole('button', { name: /Perkakas E2E/ })).toContainText('1 barang')
  })

  test('renaming a kategori updates the barang that uses it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await page.goto('/kategori')
    await page.getByRole('button', { name: '+ Kategori baru' }).click()
    const create = page.getByRole('dialog', { name: 'Kategori baru' })
    await create.getByLabel(/Nama kategori/).fill('Rename Saya')
    await create.getByRole('button', { name: 'Simpan' }).click()
    await expect(create).toBeHidden()

    await page.goto('/kamus')
    await page.getByRole('button', { name: '+ Barang baru' }).click()
    const barang = page.getByRole('dialog', { name: 'Barang baru' })
    await barang.getByLabel('Nama barang').fill('E2E Barang Rename')
    await barang.getByRole('combobox', { name: 'Kategori' }).click()
    await barang.getByRole('option', { name: 'Rename Saya' }).click()
    await barang.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByRole('dialog', { name: 'Ukuran baru' })).toBeVisible()

    await page.goto('/kategori')
    await page.getByRole('button', { name: /Rename Saya/ }).click()
    const edit = page.getByRole('dialog', { name: 'Ubah kategori' })
    await edit.getByLabel(/Nama kategori/).fill('Sudah Diganti')
    await edit.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByRole('button', { name: /Sudah Diganti/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Rename Saya/ })).toHaveCount(0)

    await page.goto('/kamus')
    await expect(page.getByText('Sudah Diganti')).toBeVisible()
    await expect(page.getByText('Rename Saya')).toHaveCount(0)
  })

  test('existing free-text kategori appear in the dropdown with no migration step', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await page.goto('/kamus')
    await page.evaluate(async () => {
      const open = indexedDB.open('toko-bahan-bangunan')
      const idb: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      const stamp = { updatedAt: '2026-09-01T00:00:00.000Z', updatedByEventId: 'seed' }
      await new Promise<void>((resolve, reject) => {
        const transaction = idb.transaction('barangProj', 'readwrite')
        transaction.objectStore('barangProj').put({ id: 'legacy-1', nama: 'Legacy Semen', kategori: 'Semen Lama', diarsipkan: false, ...stamp })
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      idb.close()
    })
    await page.reload()
    await page.getByRole('button', { name: '+ Barang baru' }).click()
    const barang = page.getByRole('dialog', { name: 'Barang baru' })
    await barang.getByRole('combobox', { name: 'Kategori' }).click()
    await expect(barang.getByRole('option', { name: 'Semen Lama' })).toBeVisible()
  })
})
