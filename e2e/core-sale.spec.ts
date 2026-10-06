import { animasiSelesai } from './settle'
import { test, expect, type Page } from '@playwright/test'
import { contrastRatio, parseRgb, effectiveBackground } from './contrast'

// Phase 2's headline claim: "the shop can run on this". offline.spec.ts
// proves the shell boots and navigates offline; this spec proves the actual
// core-sale workflow (create an item, sell it, see it in the sales list)
// works end to end against a real service worker with the network disabled,
// plus real-browser touch-target and contrast checks for the screens this
// phase built (Stok, Kasir).

// Kaca Putih E1 replaced Kasir's inline "barang tidak ditemukan -> Tambah
// barang baru" flow: it no longer uses the old flat ItemForm (deleted), it
// opens BarangPicker (pick an existing barang or quick-create one via its
// own "+" trigger, which shares the "Tambah barang baru" accessible name
// with Kasir's own outer prompt - the two are never visible at once, see
// Kasir.tsx/Kasir.test.tsx) followed by UkuranSheet (always a fresh ukuran:
// Ukuran/Harga eceran/Stok minimum, no "Satuan dasar"/"Stok awal" fields -
// those were ItemForm-only concepts). Both sheets are native <dialog>s
// (role "dialog"), scoped here because BarangPicker's own "Nama barang"
// combobox stays mounted underneath BarangSheet's identically-labelled
// field. Submitting UkuranSheet also adds the new ukuran straight to the
// cart at qty 1 (Kasir.tsx's handleUkuranCreated) - there is no separate
// "create only" step anymore. Leaves the page on /kasir with `opts.nama`
// already searched for and its add-to-cart button visible.
async function createItemViaKasir(
  page: Page,
  opts: { nama: string; baseUnit?: string; harga?: string; stokMinimum?: string },
) {
  await page.goto('/kasir')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kasir')

  await page.getByLabel('Cari barang').fill(opts.nama)
  // Kasir's own "no match" prompt - opens the inline-create section.
  await page.getByRole('button', { name: 'Tambah barang baru' }).click()
  // BarangPicker's own "+" quick-add trigger, opening BarangSheet.
  await page.getByRole('button', { name: 'Tambah barang baru' }).click()

  const barangDialog = page.getByRole('dialog')
  await expect(barangDialog.getByLabel('Nama barang')).toHaveValue(opts.nama)
  await barangDialog.getByRole('button', { name: 'Simpan' }).click()

  // BarangSheet closes once the barang is created; UkuranSheet opens next
  // (Kasir.tsx renders it once the picked/created barangId is set).
  const ukuranDialog = page.getByRole('dialog')
  await ukuranDialog.getByLabel('Ukuran').fill(opts.baseUnit ?? 'sak')
  await ukuranDialog.getByLabel('Harga eceran').fill(opts.harga ?? '52000')
  await ukuranDialog.getByLabel('Stok minimum').fill(opts.stokMinimum ?? '5')
  await ukuranDialog.getByRole('button', { name: 'Simpan' }).click()

  // The inline section only closes on a successful write, which also
  // clears the search field - re-searching for the item and finding its
  // add-to-cart button is what proves the write actually landed. The
  // button's own accessible name is "Tambah {barang nama} {ukuran} ke
  // keranjang" (ProductCard.tsx) - the barang/ukuran split means the
  // ukuran text is part of the name too, unlike the old flat ItemForm.
  await page.getByLabel('Cari barang').fill(opts.nama)
  await expect(page.getByRole('button', { name: addToCartButtonName(opts.nama, opts.baseUnit ?? 'sak') })).toBeVisible()
}

const addToCartButtonName = (nama: string, ukuran: string) => `Tambah ${nama} ${ukuran} ke keranjang`

test.describe('core sale flow, offline', () => {
  // TopNav (and its "Transaksi" link) is `hidden md:flex`; BottomNav's phone
  // bar has no direct Transaksi tab (it lives inside the not-yet-built
  // "Lainnya" sheet, per navItems.ts), so this flow has no offline-reachable
  // path to /transaksi on a phone viewport yet. Desktop-only, matching how
  // shell.spec.ts gates its own desktop-nav checks.
  test.skip(({ isMobile }) => !!isMobile, 'Transaksi is reachable only from the desktop TopNav this phase')

  test('creating an item, selling it in Kasir, and seeing it in Transaksi works fully offline', async ({ page, context }, testInfo) => {
    // This is a functional proof, not a visual one: the flow does not
    // depend on colour scheme, and this is the heaviest test in the suite
    // (multiple full-page reloads plus a real service-worker install).
    // playwright.config.ts already notes that high worker counts starve
    // page.goto() under contention; running once (desktop-light) rather
    // than once per theme keeps this spec's contribution to that load
    // down without dropping coverage the brief actually asks for.
    test.skip(testInfo.project.name.endsWith('-dark'), 'functional flow does not depend on colour scheme')
    const heading = page.getByRole('heading', { level: 1 })
    const itemName = 'E2E Semen Offline'

    // Same setup ritual as offline.spec.ts: load online so the service
    // worker installs and precaches, reload once so the now-active worker
    // starts controlling requests, then go offline.
    await page.goto('/')
    await expect(heading).toHaveText('Beranda')
    await activateServiceWorker(page)
    await expect(heading).toHaveText('Beranda')

    await context.setOffline(true)

    // 1. Create a real item, offline, via Kasir's own inline create flow.
    // This also leaves the page on Kasir with the item already searched for.
    await createItemViaKasir(page, { nama: itemName, harga: '52000', stokMinimum: '5' })
    await expect(heading).toHaveText('Kasir')

    // 2. The create flow's own UkuranSheet submit already added the new
    // ukuran to the cart at qty 1 (no stock yet - D7 warns, never blocks -
    // so the sale still goes through). Confirm the total, then sell it, offline.
    await expect(page.getByTestId('kasir-total')).toContainText('Rp 52.000')

    await page.getByRole('button', { name: 'Simpan transaksi' }).click()
    await expect(page.getByText('Transaksi tersimpan')).toBeVisible()

    // 3. Confirm it landed in Transaksi, offline, with the right total.
    await page.getByRole('link', { name: 'Transaksi' }).first().click()
    await expect(heading).toHaveText('Transaksi')
    const row = page.getByRole('table', { name: 'Daftar transaksi' }).locator('tbody tr').filter({ hasText: itemName })
    await expect(row).toBeVisible()
    await expect(row.getByText('Rp 52.000')).toBeVisible()

    await context.setOffline(false)
  })
})

test.describe('Kasir touch targets', () => {
  test('the add-to-cart button and the cart qty stepper buttons render at least 44px', async ({ page, isMobile }, testInfo) => {
    // Box size comes from the min-h-tap/min-w-tap utilities (fixed 44px),
    // not from colour scheme, so light-theme coverage on both viewports is
    // enough; running the dark variant too would only add load (see the
    // contention note on the offline flow test above) for zero extra signal.
    test.skip(testInfo.project.name.endsWith('-dark'), 'touch-target size does not depend on colour scheme')

    const itemName = 'E2E Touch Target'
    await createItemViaKasir(page, { nama: itemName, harga: '15000', stokMinimum: '5' })

    const addButton = page.getByRole('button', { name: addToCartButtonName(itemName, 'sak') })
    await animasiSelesai(page)
    const addBox = await addButton.boundingBox()
    expect(addBox, 'add-to-cart button has no box').not.toBeNull()
    expect(addBox!.height, 'add-to-cart button height').toBeGreaterThanOrEqual(44)
    expect(addBox!.width, 'add-to-cart button width').toBeGreaterThanOrEqual(44)

    await addButton.click()

    // On a phone the cart lives in a bottom sheet behind a summary bar.
    if (isMobile) await page.getByRole('button', { name: /Lihat keranjang/ }).click()

    await expect(page.getByRole('button', { name: 'Kurangi jumlah' })).toBeVisible()
    await animasiSelesai(page)
    const minus = page.getByRole('button', { name: 'Kurangi jumlah' })
    const plus = page.getByRole('button', { name: 'Tambah jumlah' })
    for (const stepper of [minus, plus]) {
      const box = await stepper.boundingBox()
      expect(box, 'qty stepper button has no box').not.toBeNull()
      expect(box!.height, 'qty stepper button height').toBeGreaterThanOrEqual(44)
      expect(box!.width, 'qty stepper button width').toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('status color contrast', () => {
  // Colour values are theme-driven, not viewport-driven: the desktop
  // light/dark projects already exercise both themes MASTER.md section 3
  // measures, so the phone projects are skipped here to hold down total
  // load (see the contention note on the offline flow test above) rather
  // than re-measuring the same computed colours a second time.
  test.skip(({ isMobile }) => !!isMobile, 'colour does not depend on viewport; desktop covers both themes')

  // A freshly-created ukuran has no stock movement yet, so it carries
  // quantity 0, which is the "habis" status: the same danger colouring
  // MASTER.md section 12 warns
  // the old Kasir/Beranda mockups got wrong (white text on the old mint
  // CTA, by extension the highest-risk status color to leave unverified).
  test('the Stok status pill renders readable text against its actual background', async ({ page }) => {
    const itemName = 'E2E Kontras Stok'
    await createItemViaKasir(page, { nama: itemName, harga: '10000', stokMinimum: '5' })

    await page.goto('/stok')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stok')

    // Scoped to the visible-rows list (Stok.tsx renders a <ul>, not a
    // table): StockFilters' own "Habis" status-toggle button also carries
    // the exact text "Habis" outside it.
    const pillSelector = 'ul >> text="Habis"'
    const pill = page.locator(pillSelector)
    await expect(pill).toBeVisible()

    const textColor = await pill.evaluate((el) => getComputedStyle(el).color)
    const bgColor = await effectiveBackground(page, pillSelector)

    const ratio = contrastRatio(parseRgb(textColor), parseRgb(bgColor))
    expect(ratio, `text ${textColor} on background ${bgColor}`).toBeGreaterThanOrEqual(4.5)
  })

  test('the Kasir product-card status line renders readable text against its actual background', async ({ page }) => {
    const itemName = 'E2E Kontras Kasir'
    await createItemViaKasir(page, { nama: itemName, harga: '10000', stokMinimum: '5' })

    // ProductCard.tsx (Kaca Putih E1's barang-card rework) renders
    // "{status} - sisa {quantity}", with no unit suffix - unlike the old
    // one-card-per-ukuran ProductRow layout this replaced.
    const lineSelector = 'text="Habis - sisa 0"'
    const line = page.locator(lineSelector)
    await expect(line).toBeVisible()

    const textColor = await line.evaluate((el) => getComputedStyle(el).color)
    const bgColor = await effectiveBackground(page, lineSelector)

    const ratio = contrastRatio(parseRgb(textColor), parseRgb(bgColor))
    expect(ratio, `text ${textColor} on background ${bgColor}`).toBeGreaterThanOrEqual(4.5)
  })
})
async function activateServiceWorker(page: Page) {
  await page.waitForFunction(async () => {
    const registrations = await navigator.serviceWorker?.getRegistrations()
    return registrations?.some(registration => registration.active) ?? false
  }, { timeout: 15_000 })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, { timeout: 15_000 })
}
