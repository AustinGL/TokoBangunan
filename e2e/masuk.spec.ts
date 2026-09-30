import { test, expect } from '@playwright/test'

// Real-browser checks for the optional sign-in screen. The network to Supabase
// is intercepted: nothing here talks to a real project or uses a real password.
// A form that fails to intercept its own submit navigates the page away in
// Chrome (a bug this app has already had once), which jsdom cannot see, so the
// "stays on /masuk" assertions are the point of the first test.

test.describe('sign-in screen', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await page.goto('/masuk')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // A build without a .env is local-only by design and shows no form.
    const localOnly = await page.getByText(/cadangan cloud belum diatur/i).isVisible()
    test.skip(localOnly, 'no cloud project configured for this build')
  })

  test('a wrong password shows a plain reason and stays on the form, without navigating away', async ({ page }) => {
    await page.route('**/auth/v1/token**', route =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }),
      }),
    )

    await page.getByLabel('Email').fill('pemilik@toko.id')
    await page.getByLabel('Password').fill('bukan-password-sungguhan')
    await page.getByRole('button', { name: 'Masuk' }).click()

    await expect(page.getByRole('alert')).toHaveText('Email atau password salah.')
    await expect(page).toHaveURL(/\/masuk$/)
    await expect(page.getByLabel('Email')).toHaveValue('pemilik@toko.id')
    await expect(page.getByRole('button', { name: 'Masuk' })).toBeEnabled()
  })

  test('an empty form asks for both fields without any request', async ({ page }) => {
    let requested = false
    await page.route('**/auth/v1/**', route => { requested = true; return route.abort() })

    await page.getByRole('button', { name: 'Masuk' }).click()

    await expect(page.getByText('Email wajib diisi.')).toBeVisible()
    await expect(page.getByText('Password wajib diisi.')).toBeVisible()
    await expect(page).toHaveURL(/\/masuk$/)
    expect(requested).toBe(false)
  })

  test('fits the screen without horizontal scroll and every control is at least 44px tall', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    for (const control of [page.getByLabel('Email'), page.getByLabel('Password'), page.getByRole('button', { name: 'Masuk' })]) {
      const box = await control.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(43.5)
    }
  })
})

test.describe('reaching the sign-in screen', () => {
  test('from the sync indicator on a wide screen', async ({ page, isMobile }, testInfo) => {
    test.skip(!!isMobile || testInfo.project.name.endsWith('-dark'), 'the sidebar indicator is the desktop entry')
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const indicator = page.getByRole('link', { name: /buka akun/i })
    test.skip(!(await indicator.isVisible()), 'no cloud project configured for this build')

    await indicator.click()

    await expect(page).toHaveURL(/\/masuk$/)
  })

  test('from the Lainnya sheet on a phone', async ({ page, isMobile }, testInfo) => {
    test.skip(!isMobile || testInfo.project.name.endsWith('-dark'), 'the Lainnya sheet is the phone entry')
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.getByRole('button', { name: 'Lainnya' }).click()
    const entry = page.getByRole('link', { name: /akun dan cadangan/i })
    test.skip(!(await entry.isVisible()), 'no cloud project configured for this build')
    await entry.click()

    await expect(page).toHaveURL(/\/masuk$/)
  })
})

test.describe('the reminder to sign in', () => {
  test('appears on an ordinary screen, leads to the sign-in screen, and stays off Kasir', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await page.goto('/masuk')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    test.skip(await page.getByText(/cadangan cloud belum diatur/i).isVisible(), 'no cloud project configured for this build')

    await page.goto('/stok')
    const reminder = page.getByRole('region', { name: 'Belum masuk' })
    await expect(reminder).toBeVisible()
    await expect(reminder).toContainText('Masuk dulu agar data toko aman')

    // Client-side to Kasir (a full load would reset the sync status and prove nothing).
    await page.getByRole('button', { name: /transaksi baru/i }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'Kasir' })).toBeVisible()
    await expect(reminder).toHaveCount(0)

    await page.goto('/stok')
    await page.getByRole('region', { name: 'Belum masuk' }).getByRole('link', { name: 'Masuk' }).click()
    await expect(page).toHaveURL(/\/masuk$/)
    await expect(page.getByRole('region', { name: 'Belum masuk' })).toHaveCount(0)
  })
})

