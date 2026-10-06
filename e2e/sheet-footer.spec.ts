import { test, expect } from '@playwright/test'

// A short phone viewport (an on-screen keyboard leaves little height): the
// save button must be reachable without scrolling the sheet.
test.use({ viewport: { width: 390, height: 520 } })

test('Tambah stok: the save row is flush with the sheet bottom and visible without scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('-dark'), 'layout does not depend on colour scheme')
  await page.goto('/stok')
  await page.getByRole('button', { name: /tambah stok/i }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Tambah stok' })
  await expect(sheet).toBeVisible()
  const save = sheet.getByRole('button', { name: 'Simpan stok' })
  await expect(save).toBeInViewport({ ratio: 1 })
  await expect(sheet.getByRole('button', { name: 'Simpan & tambah lagi' })).toBeInViewport({ ratio: 1 })

  const [sheetBox, footerBox] = [await sheet.boundingBox(), await save.locator('..').boundingBox()]
  expect(sheetBox && footerBox).toBeTruthy()
  // The shared body has 16px padding. SheetFooter consumes that padding so
  // the action surface reaches the panel edge instead of floating above it.
  expect(Math.abs((sheetBox!.y + sheetBox!.height) - (footerBox!.y + footerBox!.height))).toBeLessThanOrEqual(2)
})

test('Supplier baru: the save button is visible without scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('-dark'), 'layout does not depend on colour scheme')
  await page.goto('/supplier')
  await page.getByRole('button', { name: '+ Supplier baru' }).click()
  const sheet = page.getByRole('dialog', { name: 'Supplier baru' })
  await expect(sheet.getByRole('button', { name: /^Simpan/ })).toBeInViewport({ ratio: 1 })
})

test('a validation error still surfaces with the footer in place', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('-dark'), 'layout does not depend on colour scheme')
  await page.goto('/supplier')
  await page.getByRole('button', { name: '+ Supplier baru' }).click()
  const sheet = page.getByRole('dialog', { name: 'Supplier baru' })
  await sheet.getByRole('button', { name: /^Simpan/ }).click()
  await expect(sheet.getByText('Nama supplier wajib diisi.')).toBeInViewport()
})

test.describe('narrowest phone (360px wide)', () => {
  test.use({ viewport: { width: 360, height: 520 } })

  test('Tambah stok: neither save button overflows the viewport and both stay on screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'layout does not depend on colour scheme')
    await page.goto('/stok')
    await page.getByRole('button', { name: /tambah stok/i }).first().click()
    const sheet = page.getByRole('dialog', { name: 'Tambah stok' })
    await expect(sheet).toBeVisible()
    const save = sheet.getByRole('button', { name: 'Simpan stok' })
    const again = sheet.getByRole('button', { name: 'Simpan & tambah lagi' })
    await expect(save).toBeInViewport({ ratio: 1 })
    await expect(again).toBeInViewport({ ratio: 1 })

    const [saveBox, againBox] = [await save.boundingBox(), await again.boundingBox()]
    expect(saveBox && againBox).toBeTruthy()
    // Nothing pokes past the right edge, and the two buttons do not overlap.
    expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(360)
    expect(againBox!.x + againBox!.width).toBeLessThanOrEqual(360)
    expect(againBox!.x).toBeGreaterThanOrEqual(0)
    expect(againBox!.x + againBox!.width).toBeLessThanOrEqual(saveBox!.x)
    // The page itself never scrolls sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
