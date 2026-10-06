import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { recordCustomer, recordSale, catatPembayaran } from '../../data/commands'
import { systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'
import { Piutang } from './Piutang'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const ctx = { clock: systemClock, deviceId: 'laptop' }
const bon = (customerId: string, total: number, hariKeDepan: number) => recordSale({
  lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
  metodeBayar: 'bon', customerId, jatuhTempo: isoDateDaysAgo(systemClock, -hariKeDepan),
}, ctx)

const renderPiutang = () => render(<MemoryRouter><Piutang /></MemoryRouter>)

describe('Piutang', () => {
  it('has one h1 named Piutang', async () => {
    renderPiutang()
    expect(screen.getByRole('heading', { level: 1, name: 'Piutang' })).toBeInTheDocument()
  })

  it('shows an honest empty state with a way to Kasir', async () => {
    renderPiutang()
    expect(await screen.findByText('Belum ada piutang. Bon dari Kasir akan muncul di sini.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buka Kasir' })).toHaveAttribute('href', '/kasir')
  })

  it('totals what is owed and counts customers and overdue ones', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const sari = await recordCustomer({ nama: 'Sari' }, ctx)
    await bon(budi, 100000, -5)
    await bon(sari, 60000, 20)
    renderPiutang()

    expect(await screen.findByText('Total piutang berjalan')).toBeInTheDocument()
    expect(screen.getByText('Rp 160.000')).toBeInTheDocument()
    expect(screen.getByText('2 pelanggan · 1 lewat tempo')).toBeInTheDocument()
  })

  it('lists customers most urgent first, each linking to its detail, with the status in words', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const sari = await recordCustomer({ nama: 'Sari' }, ctx)
    const tono = await recordCustomer({ nama: 'Tono' }, ctx)
    await bon(sari, 60000, 20)   // berjalan
    await bon(budi, 100000, -5)  // lewat 5 hari
    await bon(tono, 30000, 2)    // segera
    renderPiutang()

    const list = await screen.findByRole('list', { name: 'Daftar piutang' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map(r => within(r).getByRole('link').textContent)).toEqual([
      expect.stringContaining('Budi'), expect.stringContaining('Tono'), expect.stringContaining('Sari'),
    ])
    expect(within(rows[0]).getByText('Lewat 5 hari')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Jatuh tempo 2 hari lagi')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Berjalan')).toBeInTheDocument()
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', `/piutang/${budi}`)
    expect(within(rows[0]).getByText('1 nota')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Rp 100.000')).toBeInTheDocument()
  })

  it('drops a customer once every nota is paid', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const saleId = await bon(budi, 100000, 10)
    await catatPembayaran({ saleId, jumlah: 100000 }, ctx)
    renderPiutang()
    expect(await screen.findByText('Belum ada piutang. Bon dari Kasir akan muncul di sini.')).toBeInTheDocument()
  })

  it('names a customer this device has not synced as "Pelanggan tidak dikenal"', async () => {
    await bon('belum-sinkron', 50000, 10)
    renderPiutang()
    expect(await screen.findByText('Pelanggan tidak dikenal')).toBeInTheDocument()
  })
})

describe('Piutang: catatan pengingat', () => {
  it('shows on a customer’s row that they were reminded, and not on others', async () => {
    const { catatPengingat } = await import('../../data/commands')
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const sari = await recordCustomer({ nama: 'Sari' }, ctx)
    await bon(budi, 100000, -5)
    await bon(sari, 60000, 20)
    await catatPengingat(budi, ctx)
    renderPiutang()

    const rows = within(await screen.findByRole('list', { name: 'Daftar piutang' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Diingatkan')
    expect(rows[1]).not.toHaveTextContent('Diingatkan')
  })
})
