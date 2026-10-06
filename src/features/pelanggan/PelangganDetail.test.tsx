import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { db } from '../../data/db'
import { recordCustomer, recordSale, catatPembayaran } from '../../data/commands'
import { systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'
import { shortNota } from '../../domain/nota'
import { PelangganDetail } from './PelangganDetail'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const ctx = { clock: systemClock, deviceId: 'laptop' }
const bon = (customerId: string, total: number, hariKeDepan: number) => recordSale({
  lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
  metodeBayar: 'bon', customerId, jatuhTempo: isoDateDaysAgo(systemClock, -hariKeDepan),
}, ctx)

const renderDetail = (id: string) => render(
  <MemoryRouter initialEntries={[`/pelanggan/${id}`]}>
    <Routes>
      <Route path="/pelanggan" element={<p>daftar pelanggan</p>} />
      <Route path="/pelanggan/:customerId" element={<PelangganDetail />} />
    </Routes>
  </MemoryRouter>,
)

describe('PelangganDetail', () => {
  it('shows contact details and the full Bon history of a customer who has paid everything', async () => {
    const budi = await recordCustomer({ nama: 'Budi', telepon: '0812-555', alamat: 'Jl. Mawar 3' }, ctx)
    const saleId = await bon(budi, 100000, 10)
    await catatPembayaran({ saleId, jumlah: 100000, catatan: 'lunas tunai' }, ctx)
    renderDetail(budi)

    expect(await screen.findByRole('heading', { level: 1, name: 'Budi' })).toBeInTheDocument()
    expect(screen.getByText('0812-555')).toBeInTheDocument()
    expect(screen.getByText('Jl. Mawar 3')).toBeInTheDocument()
    expect(screen.getByText('Tidak ada piutang')).toBeInTheDocument()

    const notas = within(await screen.findByRole('list', { name: 'Riwayat Bon' })).getAllByRole('listitem')
    expect(notas).toHaveLength(1)
    expect(within(notas[0]).getByText(shortNota(saleId))).toBeInTheDocument()
    expect(within(notas[0]).getByText('Lunas')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Riwayat pembayaran' })).getByText('lunas tunai')).toBeInTheDocument()
  })

  it('links a customer who still owes to their Piutang page', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    await bon(budi, 100000, 10)
    renderDetail(budi)

    expect(await screen.findByRole('link', { name: 'Buka piutang' })).toHaveAttribute('href', `/piutang/${budi}`)
    expect(screen.getAllByText('Rp 100.000').length).toBeGreaterThan(0)
  })

  it('says so for a customer who never took Bon', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    renderDetail(budi)
    expect(await screen.findByText('Belum ada Bon.')).toBeInTheDocument()
  })

  it('edits the name and phone, which a paid-off customer could not do before', async () => {
    const user = userEvent.setup()
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    renderDetail(budi)
    await user.click(await screen.findByRole('button', { name: 'Ubah' }))
    await user.clear(screen.getByLabelText('Nama'))
    await user.type(screen.getByLabelText('Nama'), 'Budi Santoso')
    await user.type(screen.getByLabelText('Telepon'), '0812-999')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Budi Santoso' })).toBeInTheDocument()
    await waitFor(async () => expect((await db.customersProj.get(budi))?.telepon).toBe('0812-999'))
  })

  it('has an honest not-found for an unknown customer', async () => {
    renderDetail('tidak-ada')
    expect(await screen.findByText('Pelanggan tidak ditemukan.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Pelanggan' })).toHaveAttribute('href', '/pelanggan')
  })
})

describe('PelangganDetail: kelebihan bayar', () => {
  it('says so, with the amount, on the customer and on the nota, so a double-recorded payment is not silently absorbed', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const saleId = await bon(budi, 100000, 10)
    const t = new Date().toISOString()
    await db.paymentsProj.put({ id: 'p-a', saleId, jumlah: 100000, occurredAt: t, recordedAt: t, deviceId: 'hp' })
    await db.paymentsProj.put({ id: 'p-b', saleId, jumlah: 100000, occurredAt: t, recordedAt: t, deviceId: 'laptop' })
    renderDetail(budi)

    const peringatan = await screen.findByRole('alert')
    expect(peringatan).toHaveTextContent('Kelebihan bayar Rp 100.000')
    expect(peringatan).toHaveTextContent('dua perangkat')
    const nota = within(screen.getByRole('list', { name: 'Riwayat Bon' })).getAllByRole('listitem')[0]
    expect(nota).toHaveTextContent('Lunas')
    expect(nota).toHaveTextContent('Kelebihan bayar Rp 100.000')
  })

  it('shows no warning when nothing is overpaid', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const saleId = await bon(budi, 100000, 10)
    await catatPembayaran({ saleId, jumlah: 100000 }, ctx)
    renderDetail(budi)
    await screen.findByText('Tidak ada piutang')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
