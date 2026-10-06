import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { db } from '../../data/db'
import { ToastProvider } from '../../ui/Toast'
import { Beranda } from './Beranda'
import type { Sale } from '../../domain/projections/sales'
import { recordCustomer, recordSale } from '../../data/commands'
import { systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const TS = '2026-09-18T07:00:00.000Z'

const seedBarang = (id: string, nama: string) =>
  db.barangProj.put({ id, nama, diarsipkan: false, updatedAt: TS, updatedByEventId: 'e0' })

const seedUkuran = (id: string, barangId: string, nama: string, baseUnit: string, stokMinimum: number) =>
  db.itemsProj.put({
    id, nama, baseUnit, units: [{ unit: baseUnit, factor: 1 }], hargaEceran: 65000, stokMinimum,
    barangId, diarsipkan: false, updatedAt: TS, updatedByEventId: 'e1',
  })

const seedStok = (itemId: string, whole: number) =>
  db.stokProj.put({ itemId, quantity: whole * 1000, lastMovementAt: TS, lastMovementEventId: 'e2' })

const seedSale = (over: Partial<Sale> & Pick<Sale, 'id' | 'occurredAt'>) =>
  db.salesProj.put({
    lines: [{ itemId: 'u1', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 65000, subtotal: 65000 }],
    metodeBayar: 'tunai', subtotal: 65000, diskon: 0, total: 65000, deliveryIntent: 'dibawa',
    recordedAt: over.occurredAt, deviceId: 'd1', status: 'aktif', itemIds: ['u1'], batchIds: [], ...over,
  })

function LocationProbe() {
  const loc = useLocation()
  return <span data-testid="loc">{loc.pathname + loc.search}</span>
}

const renderBeranda = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Beranda />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

describe('Beranda', () => {
  it('keeps a page heading named Beranda for assistive tech while loading and after', async () => {
    renderBeranda()
    expect(screen.getByRole('heading', { name: 'Beranda' })).toBeInTheDocument()
    await screen.findByText('Ringkasan stok')
    expect(screen.getByRole('heading', { name: 'Beranda' })).toBeInTheDocument()
  })

  it('rewards an empty inbox instead of showing a blank card', async () => {
    await seedBarang('b1', 'Semen')
    await seedUkuran('u1', 'b1', 'Semen', 'sak', 10)
    await seedStok('u1', 50)
    renderBeranda()
    expect(await screen.findByText('Semua beres. Tidak ada yang perlu diurus hari ini.')).toBeInTheDocument()
  })

  it('does not claim "all clear" for a shop with no barang at all: it shows the first three steps', async () => {
    renderBeranda()
    expect(await screen.findByText('Mulai di sini')).toBeInTheDocument()
    expect(screen.queryByText(/Semua beres/)).toBeNull()
    expect(screen.getByRole('link', { name: /Tambah barang dan ukurannya/ })).toHaveAttribute('href', '/kamus')
    expect(screen.getByRole('link', { name: /Catat stok pertama/ })).toHaveAttribute('href', '/stok?tambah=1')
    expect(screen.getByRole('link', { name: /Mulai jual di Kasir/ })).toHaveAttribute('href', '/kasir')
  })

  it('shows honest empties for money owed and profit rather than made-up figures', async () => {
    renderBeranda()
    await screen.findByText('Ringkasan stok')
    expect(screen.getByText('Belum ada piutang.')).toBeInTheDocument()
    expect(screen.getByText('Belum ada penjualan hari ini.')).toBeInTheDocument()
    expect(screen.getByText('Belum ada transaksi.')).toBeInTheDocument()
  })

  it('totals today\'s sales in the focal card and counts them', async () => {
    const now = new Date()
    await seedSale({ id: 's1', occurredAt: now.toISOString(), total: 50000 })
    await seedSale({ id: 's2', occurredAt: now.toISOString(), total: 70000 })
    renderBeranda()

    await screen.findByText('Penjualan hari ini')
    const focal = screen.getByText('Penjualan hari ini').closest('section') as HTMLElement
    expect(within(focal).getByText('120.000')).toBeInTheDocument()
    expect(within(focal).getByText('2 transaksi')).toBeInTheDocument()
  })

  it('excludes a cancelled sale from the day\'s total', async () => {
    await seedSale({ id: 's1', occurredAt: new Date().toISOString(), total: 50000, status: 'batal' })
    renderBeranda()
    await screen.findByText('Penjualan hari ini')
    const focal = screen.getByText('Penjualan hari ini').closest('section') as HTMLElement
    expect(within(focal).getByText('0 transaksi')).toBeInTheDocument()
  })

  it('states how many lines have a known harga beli next to the laba figure', async () => {
    await db.batchesProj.put({
      batchId: 'b1', itemId: 'u1', hargaBeli: 50000, hargaJual: 65000, tanggalBeli: TS, diterima: 10000, sisa: 9000,
      metaUpdatedAt: TS, metaUpdatedByEventId: 'e3', lastMovementAt: TS, lastMovementEventId: 'e3',
    })
    await seedSale({
      id: 's1', occurredAt: new Date().toISOString(),
      lines: [
        { itemId: 'u1', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 65000, subtotal: 65000, batchId: 'b1' },
        { itemId: 'u2', nama: 'Cat', unit: 'kaleng', qty: 1000, hargaSatuan: 30000, subtotal: 30000 },
      ],
      total: 95000,
    })
    renderBeranda()
    expect(await screen.findByText('1 dari 2 baris punya harga beli.')).toBeInTheDocument()
    // (65.000 - 50.000) * 1 = 15.000, from the covered line only
    expect(screen.getByText('15.000')).toBeInTheDocument()
  })

  it('lists a habis barang with a link that prefills Tambah stok', async () => {
    const user = userEvent.setup()
    await seedBarang('b1', 'Semen Tiga Roda')
    await seedUkuran('u1', 'b1', 'Semen Tiga Roda', 'sak', 10)
    await seedStok('u1', 0)
    renderBeranda()

    const row = await screen.findByRole('link', { name: /Semen Tiga Roda habis/ })
    await user.click(row)
    expect(screen.getByTestId('loc')).toHaveTextContent('/stok?tambah=1&barang=b1&ukuran=u1')
  })

  it('collapses many menipis barang into one expandable row', async () => {
    for (const n of [1, 2, 3, 4]) {
      await seedBarang(`b${n}`, `Barang ${n}`)
      await seedUkuran(`u${n}`, `b${n}`, `Barang ${n}`, 'pcs', 10)
      await seedStok(`u${n}`, 3)
    }
    renderBeranda()
    expect(await screen.findByText('4 barang menipis')).toBeInTheDocument()
    expect(screen.queryByText('Barang 1 menipis')).toBeNull()
  })

  it('summarises stock health as real text next to the ring', async () => {
    await seedBarang('b1', 'A'); await seedUkuran('u1', 'b1', 'A', 'pcs', 10); await seedStok('u1', 50)
    await seedBarang('b2', 'B'); await seedUkuran('u2', 'b2', 'B', 'pcs', 10); await seedStok('u2', 3)
    await seedBarang('b3', 'C'); await seedUkuran('u3', 'b3', 'C', 'pcs', 10); await seedStok('u3', 0)
    renderBeranda()
    const card = (await screen.findByText('Ringkasan stok')).closest('section') as HTMLElement
    expect(within(card).getByText('1 menipis')).toBeInTheDocument()
    expect(within(card).getByText('1 habis')).toBeInTheDocument()
    expect(within(card).getAllByText(/aman/).length).toBeGreaterThan(0)
  })

  it('opens the sale detail from a recent transaction', async () => {
    const user = userEvent.setup()
    await seedSale({ id: 'sale-abc-123456', occurredAt: new Date().toISOString() })
    renderBeranda()
    await user.click(await screen.findByRole('button', { name: /#123456/ }))
    expect(await screen.findByText('Detail transaksi')).toBeInTheDocument()
  })

  it('shows the real piutang berjalan, how many customers owe, and links to Piutang', async () => {
    const ctx = { clock: systemClock, deviceId: 'laptop' }
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const sari = await recordCustomer({ nama: 'Sari' }, ctx)
    const line = { itemId: 'u1', nama: 'Semen', unit: 'sak', qty: 1000 }
    await recordSale({ lines: [{ ...line, hargaSatuan: 100000, subtotal: 100000 }], metodeBayar: 'bon', customerId: budi, jatuhTempo: isoDateDaysAgo(systemClock, 5) }, ctx)
    await recordSale({ lines: [{ ...line, hargaSatuan: 60000, subtotal: 60000 }], metodeBayar: 'bon', customerId: sari, jatuhTempo: isoDateDaysAgo(systemClock, -20) }, ctx)
    renderBeranda()

    const link = await screen.findByRole('link', { name: '2 pelanggan, 1 lewat tempo' })
    expect(link).toHaveAttribute('href', '/piutang')
    const metric = link.closest('div')?.parentElement as HTMLElement
    expect(within(metric).getByText('160.000')).toBeInTheDocument()
    expect(screen.queryByText('Fitur piutang belum tersedia.')).toBeNull()
  })

  describe('Perlu diurus: piutang', () => {
    const ctx = { clock: systemClock, deviceId: 'laptop' }
    const withKatalog = async () => {
      await seedBarang('b1', 'Semen'); await seedUkuran('u1', 'b1', 'Semen', 'sak', 10); await seedStok('u1', 50)
    }
    const bon = (customerId: string, total: number, hariLalu: number) => recordSale({
      lines: [{ itemId: 'u1', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
      metodeBayar: 'bon', customerId, jatuhTempo: isoDateDaysAgo(systemClock, hariLalu),
    }, ctx)

    it('lists a customer who is lewat tempo, linking to their page', async () => {
      await withKatalog()
      const budi = await recordCustomer({ nama: 'Budi' }, ctx)
      await bon(budi, 450000, 12)
      renderBeranda()

      const row = await screen.findByRole('link', { name: /Budi lewat tempo 12 hari \(Rp 450\.000\)/ })
      expect(row).toHaveAttribute('href', `/piutang/${budi}`)
      expect(row).toHaveTextContent('Lihat piutang')
      expect(screen.queryByText(/Semua beres/)).toBeNull()
    })

    it('lists a customer due within three days, as a warning', async () => {
      await withKatalog()
      const sari = await recordCustomer({ nama: 'Sari' }, ctx)
      await bon(sari, 120000, -2)
      renderBeranda()
      expect(await screen.findByRole('link', { name: /Sari jatuh tempo 2 hari lagi \(Rp 120\.000\)/ })).toBeInTheDocument()
    })

    it('does not list a customer who is only berjalan, so the inbox can still be empty', async () => {
      await withKatalog()
      const tono = await recordCustomer({ nama: 'Tono' }, ctx)
      await bon(tono, 90000, -30)
      renderBeranda()
      expect(await screen.findByText('Semua beres. Tidak ada yang perlu diurus hari ini.')).toBeInTheDocument()
    })

    it('keeps the stock action label on stock rows', async () => {
      await seedBarang('b1', 'Semen'); await seedUkuran('u1', 'b1', 'Semen', 'sak', 10); await seedStok('u1', 0)
      renderBeranda()
      expect(await screen.findByRole('link', { name: /Semen habis/ })).toHaveTextContent('Tambah stok')
    })

    it('groups three overdue customers into one expandable row that links to each', async () => {
      await withKatalog()
      for (const nama of ['Ani', 'Budi', 'Cici']) await bon(await recordCustomer({ nama }, ctx), 100000, 5)
      const user = userEvent.setup()
      renderBeranda()

      expect(await screen.findByText('3 pelanggan lewat tempo')).toBeInTheDocument()
      await user.click(screen.getByText('3 pelanggan lewat tempo'))
      const links = screen.getAllByRole('link', { name: /Rp 100\.000 · lewat 5 hari/ })
      expect(links).toHaveLength(3)
      expect(links[0].getAttribute('href')).toMatch(/^\/piutang\//)
    })
  })
})

describe('Beranda: tunda "Perlu diurus"', () => {
  const ctx = { clock: systemClock, deviceId: 'laptop' }
  const KEY = 'toko-inbox-tunda'

  // A hand-rolled Storage (see data/deviceId.test.ts): the host jsdom/Node pair has no reliable real one.
  const store = new Map<string, string>()
  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  const withKatalog = async () => {
    await seedBarang('b1', 'Semen'); await seedUkuran('u1', 'b1', 'Semen', 'sak', 10); await seedStok('u1', 50)
  }
  const lewat = async (nama: string) => {
    const id = await recordCustomer({ nama }, ctx)
    await recordSale({
      lines: [{ itemId: 'u1', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 100000, subtotal: 100000 }],
      metodeBayar: 'bon', customerId: id, jatuhTempo: isoDateDaysAgo(systemClock, 5),
    }, ctx)
    return id
  }

  it('hides a row snoozed until tomorrow, says how many are snoozed, and brings it back on request', async () => {
    await withKatalog()
    await lewat('Budi')
    const user = userEvent.setup()
    renderBeranda()

    await screen.findByRole('link', { name: /Budi lewat tempo/ })
    await user.click(screen.getByRole('button', { name: /^Tunda sampai besok: Budi lewat tempo/ }))

    expect(screen.queryByRole('link', { name: /Budi lewat tempo/ })).toBeNull()
    expect(screen.getByText('1 item ditunda sampai besok.')).toBeInTheDocument()
    expect(store.get(KEY)).toContain('lewat-')

    await user.click(screen.getByRole('button', { name: 'Tampilkan lagi' }))
    expect(await screen.findByRole('link', { name: /Budi lewat tempo/ })).toBeInTheDocument()
    expect(screen.queryByText(/ditunda sampai besok/)).toBeNull()
  })

  it('does not call the inbox clear when everything is only snoozed', async () => {
    await withKatalog()
    await lewat('Budi')
    const user = userEvent.setup()
    renderBeranda()
    await user.click(await screen.findByRole('button', { name: /^Tunda sampai besok/ }))

    expect(screen.queryByText('Semua beres. Tidak ada yang perlu diurus hari ini.')).toBeNull()
    expect(screen.getByText('Semua yang perlu diurus sedang ditunda.')).toBeInTheDocument()
  })

  it('keeps a snooze across a reload, and lets an expired one go', async () => {
    await withKatalog()
    const budi = await lewat('Budi')
    const besok = new Date(Date.now() + 86_400_000).toISOString()
    store.set(KEY, JSON.stringify({ [`lewat-${budi}`]: besok }))
    const { unmount } = renderBeranda()
    expect(await screen.findByText('1 item ditunda sampai besok.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Budi lewat tempo/ })).toBeNull()
    unmount()

    store.set(KEY, JSON.stringify({ [`lewat-${budi}`]: new Date(Date.now() - 1000).toISOString() }))
    renderBeranda()
    expect(await screen.findByRole('link', { name: /Budi lewat tempo/ })).toBeInTheDocument()
  })

  it('snoozes a grouped row as a whole', async () => {
    await withKatalog()
    for (const nama of ['Ani', 'Budi', 'Cici']) await lewat(nama)
    const user = userEvent.setup()
    renderBeranda()
    await screen.findByText('3 pelanggan lewat tempo')
    await user.click(screen.getByRole('button', { name: /^Tunda sampai besok: 3 pelanggan lewat tempo/ }))
    expect(screen.queryByText('3 pelanggan lewat tempo')).toBeNull()
  })
})
