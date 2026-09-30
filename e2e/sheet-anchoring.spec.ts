import { test, expect } from '@playwright/test'

// Chrome's UA stylesheet gives dialog:modal `inset-block: 0`. The side sheet
// must reset `top` itself, or on a phone the box stretches from the top down to
// its max-height instead of hanging from the bottom edge.
test.describe('phone (390x700)', () => {
  test.use({ viewport: { width: 390, height: 700 } })

  test('Tambah stok: the side sheet is anchored to the bottom of the screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'layout does not depend on colour scheme')
    await page.goto('/stok')
    await page.getByRole('button', { name: /tambah stok/i }).first().click()
    const sheet = page.getByRole('dialog', { name: 'Tambah stok' })
    await expect(sheet).toBeVisible()
    const box = await sheet.boundingBox()
    expect(box).toBeTruthy()
    expect(Math.round(box!.y + box!.height)).toBe(700)
    expect(box!.height).toBeLessThanOrEqual(0.85 * 700 + 1)
  })
})

test.describe('desktop (1280x800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('Tambah stok: the side sheet is a full-height drawer on the right', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'layout does not depend on colour scheme')
    await page.goto('/stok')
    await page.getByRole('button', { name: /tambah stok/i }).first().click()
    const sheet = page.getByRole('dialog', { name: 'Tambah stok' })
    await expect(sheet).toBeVisible()
    const box = await sheet.boundingBox()
    expect(box).toBeTruthy()
    expect(Math.round(box!.y)).toBe(0)
    expect(Math.round(box!.y + box!.height)).toBe(800)
    expect(Math.abs(box!.width - 420)).toBeLessThanOrEqual(2)
    expect(Math.round(box!.x + box!.width)).toBe(1280)
  })
})
