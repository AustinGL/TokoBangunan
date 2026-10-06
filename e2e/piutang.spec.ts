import { test, expect, type Page } from '@playwright/test'
import { contrastRatio, parseRgb, effectiveBackground } from './contrast'

// jsdom cannot see layout or paint. This covers the empty Piutang, then a
// populated one (rows written straight into the projection tables, the way
// kategori.spec.ts seeds legacy data) so the list, the detail and the payment
// sheet are checked in a real browser at phone and desktop widths.

async function seedPiutang(page: Page) {
  await page.goto('/piutang')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Piutang')
  await page.evaluate(async () => {
    const dayKey = (offset: number) => {
      const d = new Date(); d.setDate(d.getDate() + offset)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const open = indexedDB.open('toko-bahan-bangunan')
    const idb: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const now = new Date().toISOString()
    // The notas are from 20 days ago, so there is room to date a payment earlier than today.
    const dibuat = new Date(); dibuat.setDate(dibuat.getDate() - 20); dibuat.setHours(12, 0, 0, 0)
    const sale = (id: string, customerId: string, total: number, jatuhTempo: string) => ({
      id, lines: [{ itemId: 'x', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
      metodeBayar: 'bon', subtotal: total, diskon: 0, total, deliveryIntent: 'dibawa',
      occurredAt: dibuat.toISOString(), recordedAt: now, deviceId: 'seed', status: 'aktif', itemIds: ['x'], batchIds: [],
      customerId, jatuhTempo, dibayarAwal: 0,
    })
    const customer = (id: string, nama: string, telepon: string) => ({
      id, nama, telepon, tier: 'eceran', termynHari: 30, updatedAt: now, updatedByEventId: 'seed',
    })
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(['salesProj', 'customersProj'], 'readwrite')
      tx.objectStore('customersProj').put(customer('cust-budi', 'Budi Santoso dengan Nama Sangat Panjang Sekali', '0812-555-0101'))
      tx.objectStore('customersProj').put(customer('cust-sari', 'Sari', '0813-555-0202'))
      tx.objectStore('salesProj').put(sale('sale-budi-1', 'cust-budi', 300_000, dayKey(-8)))
      tx.objectStore('salesProj').put(sale('sale-sari-1', 'cust-sari', 120_000, dayKey(25)))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    idb.close()
  })
  await page.reload()
}

const overflowOf = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('piutang', () => {
  test('the empty state renders, does not overflow, and its text is readable', async ({ page }) => {
    await page.goto('/piutang')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Piutang')
    const selector = 'text="Belum ada piutang. Bon dari Kasir akan muncul di sini."'
    const text = page.locator(selector)
    await expect(text).toBeVisible()
    expect(await overflowOf(page)).toBeLessThanOrEqual(0)

    const ratio = contrastRatio(parseRgb(await text.evaluate(el => getComputedStyle(el).color)), parseRgb(await effectiveBackground(page, selector)))
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('the list puts the overdue customer first, never overflows, and rows are at least 44px tall', async ({ page }, testInfo) => {
    await seedPiutang(page)

    const rows = page.getByRole('list', { name: 'Daftar piutang' }).getByRole('listitem')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText('Budi Santoso')
    await expect(rows.first()).toContainText('Lewat 8 hari')
    await expect(rows.nth(1)).toContainText('Sari')
    await expect(page.getByText('Rp 420.000')).toBeVisible()

    expect(await overflowOf(page), `${testInfo.project.name} /piutang overflow`).toBeLessThanOrEqual(0)
    const box = await rows.first().boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test('the status text is readable against its pill', async ({ page }) => {
    await seedPiutang(page)
    const selector = 'text="Lewat 8 hari"'
    const pill = page.locator(selector)
    await expect(pill).toBeVisible()
    const ratio = contrastRatio(parseRgb(await pill.evaluate(el => getComputedStyle(el).color)), parseRgb(await effectiveBackground(page, selector)))
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('open a customer, record a partial payment, and the sisa drops', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await seedPiutang(page)

    await page.getByRole('link', { name: /Budi Santoso/ }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Budi Santoso')
    expect(await overflowOf(page)).toBeLessThanOrEqual(0)

    await page.getByRole('button', { name: /^Catat pembayaran/ }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByLabel('Jumlah dibayar')).toHaveValue('300.000')
    await sheet.getByLabel('Jumlah dibayar').fill('100000')
    await expect(sheet.getByRole('button', { name: 'Simpan pembayaran' })).toBeVisible()
    await sheet.getByRole('button', { name: 'Simpan pembayaran' }).click()

    await expect(sheet).toBeHidden()
    await expect(page.getByRole('list', { name: 'Nota belum lunas' })).toContainText('Rp 200.000')
    await expect(page.getByRole('list', { name: 'Riwayat pembayaran' })).toContainText('Rp 100.000')
  })

  test('a payment can be dated an earlier day from the calendar, and the history shows that day', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    await seedPiutang(page)
    await page.getByRole('link', { name: /Budi Santoso/ }).click()
    await page.getByRole('button', { name: /^Catat pembayaran/ }).click()
    const sheet = page.getByRole('dialog', { name: /Catat pembayaran/ })

    await sheet.getByRole('button', { name: /Tanggal bayar/ }).click()
    const kartu = page.getByRole('dialog', { name: 'Kalender Tanggal bayar' })
    await expect(kartu).toBeVisible()
    // Ten days ago, spelled the way the day buttons are named; page back if it is in the previous month.
    const { panjang, ringkas } = await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() - 10)
      const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('id-ID', o).format(d)
      return { panjang: f({ day: 'numeric', month: 'long', year: 'numeric' }), ringkas: f({ day: 'numeric', month: 'short', year: 'numeric' }) }
    })
    const hari = kartu.getByRole('button', { name: panjang })
    if (await hari.count() === 0) await kartu.getByRole('button', { name: 'Bulan sebelumnya' }).click()
    await hari.click()
    await expect(sheet.getByRole('button', { name: /Tanggal bayar/ })).toContainText(ringkas)

    await sheet.getByLabel('Jumlah dibayar').fill('100000')
    await sheet.getByRole('button', { name: 'Simpan pembayaran' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('list', { name: 'Riwayat pembayaran' })).toContainText(ringkas)
  })

  test('Kirim pengingat is a wa.me link with the message filled in, and the header buttons fit at every width', async ({ page }, testInfo) => {
    await seedPiutang(page)
    await page.getByRole('link', { name: /Budi Santoso/ }).click()

    const link = page.getByRole('link', { name: 'Kirim pengingat' })
    await expect(link).toBeVisible()
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^https:\/\/wa\.me\/628125550101\?text=/)
    expect(decodeURIComponent(href!.split('text=')[1])).toContain('sudah lewat jatuh tempo sejak')
    await expect(link).toHaveAttribute('target', '_blank')

    for (const name of ['Kirim pengingat', 'Lunasi dari yang terlama']) {
      const box = await page.getByRole(name === 'Kirim pengingat' ? 'link' : 'button', { name }).boundingBox()
      expect(box?.height ?? 0, `${testInfo.project.name} ${name} height`).toBeGreaterThanOrEqual(44)
    }
    expect(await overflowOf(page), `${testInfo.project.name} detail overflow`).toBeLessThanOrEqual(0)
  })

  test("an overdue customer shows in Beranda's inbox and as a dot on the Piutang menu", async ({ page }) => {
    await seedPiutang(page)
    // Beranda shows its first-run steps instead of the inbox until the shop has a barang.
    await page.evaluate(async () => {
      const open = indexedDB.open('toko-bahan-bangunan')
      const idb: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction('barangProj', 'readwrite')
        tx.objectStore('barangProj').put({ id: 'b-seed', nama: 'Semen', diarsipkan: false, updatedAt: new Date().toISOString(), updatedByEventId: 'seed' })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      idb.close()
    })

    await page.goto('/')
    const row = page.getByRole('link', { name: /lewat tempo 8 hari/ })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Lihat piutang')
    // Only the visible navigation exposes the link: the sidebar on desktop, the bottom bar on a phone.
    await expect(page.getByRole('link', { name: 'Piutang, 1 lewat tempo' })).toBeVisible()

    await row.click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Budi Santoso')
  })

  test('the shop name is set from the customer page and appears in the WhatsApp message, without breaking the layout', async ({ page }, testInfo) => {
    await seedPiutang(page)
    await page.getByRole('link', { name: /Budi Santoso/ }).click()
    await expect(page.getByText('Pesan belum menyebut nama toko.')).toBeVisible()

    await page.getByRole('button', { name: 'Atur nama toko' }).click()
    const sheet = page.getByRole('dialog', { name: 'Nama toko' })
    await sheet.getByRole('textbox', { name: 'Nama toko' }).fill('Toko Maju')
    await sheet.getByRole('button', { name: 'Simpan' }).click()
    await expect(sheet).toBeHidden()

    await expect(page.getByText('Pesan dikirim atas nama Toko Maju.')).toBeVisible()
    const href = await page.getByRole('link', { name: 'Kirim pengingat' }).getAttribute('href')
    expect(decodeURIComponent(href!.split('text=')[1])).toContain('Kami dari Toko Maju mengingatkan')

    const ubah = await page.getByRole('button', { name: 'Ubah', exact: true }).boundingBox()
    expect(ubah?.height ?? 0, `${testInfo.project.name} Ubah height`).toBeGreaterThanOrEqual(44)
    expect(await overflowOf(page), `${testInfo.project.name} detail overflow`).toBeLessThanOrEqual(0)
  })

  test('Kasir offers Tunai, Transfer, QRIS and Bon as payment methods', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.endsWith('-dark'), 'behaviour does not depend on colour scheme')
    // On a phone the cart panel sits in a sheet that only opens once the cart has a line; the unit tests cover it there.
    test.skip(testInfo.project.name.startsWith('phone'), 'the cart panel is behind the cart bar on a phone')
    await page.goto('/kasir')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kasir')
    await expect(page.getByRole('group', { name: 'Metode bayar' }).getByRole('button')).toHaveText(['Tunai', 'Transfer', 'QRIS', 'Bon'])
  })
})
