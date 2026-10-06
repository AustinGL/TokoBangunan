import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { recordCustomer, recordSale, catatPembayaran } from '../../data/commands'
import { systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'
import { Pelanggan } from './Pelanggan'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const ctx = { clock: systemClock, deviceId: 'laptop' }
const bon = (customerId: string, total: number, hariKeDepan: number) => recordSale({
  lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
  metodeBayar: 'bon', customerId, jatuhTempo: isoDateDaysAgo(systemClock, -hariKeDepan),
}, ctx)

const renderPelanggan = () => render(<MemoryRouter><Pelanggan /></MemoryRouter>)

describe('Pelanggan', () => {
  it('has one h1 named Pelanggan', () => {
    renderPelanggan()
    expect(screen.getByRole('heading', { level: 1, name: 'Pelanggan' })).toBeInTheDocument()
  })

  it('shows an honest empty state', async () => {
    renderPelanggan()
    expect(await screen.findByText(/Belum ada pelanggan/)).toBeInTheDocument()
  })

  it('lists every customer by name, a paid-off one too, each linking to its page', async () => {
    const budi = await recordCustomer({ nama: 'Budi', telepon: '0812-555' }, ctx)
    const agus = await recordCustomer({ nama: 'Agus' }, ctx)
    const lunas = await bon(agus, 50000, 10)
    await catatPembayaran({ saleId: lunas, jumlah: 50000 }, ctx)
    await bon(budi, 100000, 10)
    renderPelanggan()

    const list = await screen.findByRole('list', { name: 'Daftar pelanggan' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', `/pelanggan/${agus}`)
    expect(within(rows[0]).getByText('Tidak ada piutang')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Rp 100.000')).toBeInTheDocument()
    expect(within(rows[1]).getByText('0812-555')).toBeInTheDocument()
  })

  it('filters by name or phone and says so when nobody matches', async () => {
    const user = userEvent.setup()
    await recordCustomer({ nama: 'Budi', telepon: '0812-555' }, ctx)
    await recordCustomer({ nama: 'Sari' }, ctx)
    renderPelanggan()
    await screen.findByRole('list', { name: 'Daftar pelanggan' })

    const cari = screen.getByRole('textbox', { name: 'Cari pelanggan' })
    await user.type(cari, 'sar')
    expect(within(screen.getByRole('list', { name: 'Daftar pelanggan' })).getAllByRole('listitem')).toHaveLength(1)

    await user.clear(cari)
    await user.type(cari, '0812555')
    expect(screen.getByText('Budi')).toBeInTheDocument()
    expect(screen.queryByText('Sari')).toBeNull()

    await user.clear(cari)
    await user.type(cari, 'zzz')
    expect(await screen.findByText(/Tidak ada pelanggan yang cocok/)).toBeInTheDocument()
  })

  it('adds a customer from the header button', async () => {
    const user = userEvent.setup()
    renderPelanggan()
    await user.click(await screen.findByRole('button', { name: '+ Pelanggan baru' }))
    await user.type(screen.getByLabelText('Nama'), 'Tono')
    await user.type(screen.getByLabelText('Telepon'), '0811-222')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(async () => expect(await db.customersProj.count()).toBe(1))
    expect(await screen.findByText('Tono')).toBeInTheDocument()
  })
})

describe('Pelanggan: kelebihan bayar', () => {
  // catatPembayaran refuses to overpay, so this is written the way a second device's synced payment would land.
  const bayarDuaKali = async (saleId: string, jumlah: number) => {
    const t = new Date().toISOString()
    await db.paymentsProj.put({ id: 'p-a', saleId, jumlah, occurredAt: t, recordedAt: t, deviceId: 'hp' })
    await db.paymentsProj.put({ id: 'p-b', saleId, jumlah, occurredAt: t, recordedAt: t, deviceId: 'laptop' })
  }

  it('flags a customer whose payment was recorded twice, and not the others', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    await recordCustomer({ nama: 'Sari' }, ctx)
    await bayarDuaKali(await bon(budi, 100000, 10), 100000)
    renderPelanggan()

    const rows = within(await screen.findByRole('list', { name: 'Daftar pelanggan' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Budi')
    expect(rows[0]).toHaveTextContent('Kelebihan bayar Rp 100.000')
    expect(rows[1]).not.toHaveTextContent('Kelebihan bayar')
  })
})
