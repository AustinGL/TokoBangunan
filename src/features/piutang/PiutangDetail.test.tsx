import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { db } from '../../data/db'
import { recordCustomer, recordSale, catatPembayaran, aturNamaToko } from '../../data/commands'
import { fixedClock, systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'
import { shortNota } from '../../domain/nota'
import { ringkas } from '../../domain/kalender'
import { PiutangDetail } from './PiutangDetail'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const ctx = { clock: systemClock, deviceId: 'laptop' }
const bon = (customerId: string, total: number, hariKeDepan: number, dibayarAwal?: number) => recordSale({
  lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
  metodeBayar: 'bon', customerId, jatuhTempo: isoDateDaysAgo(systemClock, -hariKeDepan), dibayarAwal,
}, ctx)

const renderDetail = (customerId: string) => render(
  <MemoryRouter initialEntries={[`/piutang/${customerId}`]}>
    <Routes>
      <Route path="/piutang" element={<p>daftar piutang</p>} />
      <Route path="/piutang/:customerId" element={<PiutangDetail />} />
    </Routes>
  </MemoryRouter>,
)

describe('PiutangDetail', () => {
  it('shows the customer, their phone, the total sisa and each unpaid nota, oldest due first', async () => {
    const budi = await recordCustomer({ nama: 'Budi', telepon: '0812-555' }, ctx)
    const baru = await bon(budi, 100000, 20)
    const lama = await bon(budi, 80000, -3, 30000)
    renderDetail(budi)

    expect(await screen.findByRole('heading', { level: 1, name: 'Budi' })).toBeInTheDocument()
    expect(screen.getByText('0812-555')).toBeInTheDocument()
    expect(screen.getByText('Rp 150.000')).toBeInTheDocument() // 100000 + (80000 - 30000)

    const notas = within(screen.getByRole('list', { name: 'Nota belum lunas' })).getAllByRole('listitem')
    expect(notas).toHaveLength(2)
    expect(within(notas[0]).getByText(shortNota(lama))).toBeInTheDocument()
    expect(within(notas[0]).getByText('Lewat 3 hari')).toBeInTheDocument()
    expect(within(notas[0]).getByText('Rp 50.000')).toBeInTheDocument() // sisa
    expect(within(notas[1]).getByText(shortNota(baru))).toBeInTheDocument()
  })

  it('lists the payment history, newest first, with the nota and note', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const saleId = await bon(budi, 100000, 10)
    await catatPembayaran({ saleId, jumlah: 20000, catatan: 'cicilan 1' }, ctx)
    renderDetail(budi)

    const history = await screen.findByRole('list', { name: 'Riwayat pembayaran' })
    const row = within(history).getAllByRole('listitem')[0]
    expect(row).toHaveTextContent('Rp 20.000')
    expect(row).toHaveTextContent(shortNota(saleId))
    expect(row).toHaveTextContent('cicilan 1')
  })

  it('lists a backdated payment under the day it was received, ahead of an older one it follows', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    // The nota is from five days ago, so payments dated yesterday and the day before are allowed.
    const saleId = await recordSale({
      lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 100000, subtotal: 100000 }],
      metodeBayar: 'bon', customerId: budi, jatuhTempo: isoDateDaysAgo(systemClock, -10),
    }, { clock: fixedClock(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()), deviceId: 'laptop' })
    const kemarin = isoDateDaysAgo(systemClock, 1)
    const lusa = isoDateDaysAgo(systemClock, 2)
    await catatPembayaran({ saleId, jumlah: 10000, tanggal: lusa, catatan: 'lusa' }, ctx)
    await catatPembayaran({ saleId, jumlah: 20000, tanggal: kemarin, catatan: 'kemarin' }, ctx)
    renderDetail(budi)

    const rows = within(await screen.findByRole('list', { name: 'Riwayat pembayaran' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('kemarin')
    expect(rows[0]).toHaveTextContent(ringkas(kemarin))
    expect(rows[1]).toHaveTextContent(ringkas(lusa))
  })

  it('says so when there are no payments yet', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    await bon(budi, 100000, 10)
    renderDetail(budi)
    expect(await screen.findByText('Belum ada pembayaran.')).toBeInTheDocument()
  })

  it('Catat pembayaran on a nota records a payment and the sisa drops', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const saleId = await bon(budi, 100000, 10)
    const user = userEvent.setup()
    renderDetail(budi)

    await user.click(await screen.findByRole('button', { name: `Catat pembayaran ${shortNota(saleId)}` }))
    await user.clear(screen.getByLabelText('Jumlah dibayar'))
    await user.type(screen.getByLabelText('Jumlah dibayar'), '40000')
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))

    await waitFor(() => expect(screen.queryByLabelText('Jumlah dibayar')).toBeNull())
    const notas = within(await screen.findByRole('list', { name: 'Nota belum lunas' })).getAllByRole('listitem')
    expect(within(notas[0]).getByText('Rp 60.000')).toBeInTheDocument()
  })

  it('Lunasi dari yang terlama splits across notas', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const lama = await bon(budi, 70000, -2)
    await bon(budi, 100000, 20)
    const user = userEvent.setup()
    renderDetail(budi)

    await user.click(await screen.findByRole('button', { name: 'Lunasi dari yang terlama' }))
    await user.type(screen.getByLabelText('Jumlah dibayar'), '90000')
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))

    await waitFor(async () => expect(await db.paymentsProj.count()).toBe(2))
    expect((await db.paymentsProj.toArray()).find(p => p.saleId === lama)?.jumlah).toBe(70000)
  })

  it('a fully paid customer, and an unknown id, show the not-found state with a way back', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const saleId = await bon(budi, 100000, 10)
    await catatPembayaran({ saleId, jumlah: 100000 }, ctx)
    renderDetail(budi)
    expect(await screen.findByText('Pelanggan ini tidak punya piutang.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Piutang' })).toHaveAttribute('href', '/piutang')
  })

  it('opens the nota\'s detail from its number', async () => {
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    const saleId = await bon(budi, 100000, 10)
    const user = userEvent.setup()
    renderDetail(budi)

    await user.click(await screen.findByRole('button', { name: shortNota(saleId) }))

    expect(await screen.findByText('Detail transaksi')).toBeInTheDocument()
  })

  describe('Kirim pengingat', () => {
    const pesanDari = (link: HTMLElement) => new URL(link.getAttribute('href') as string).searchParams.get('text') as string

    it('is a wa.me link to the customer, opening in a new tab, with the amount and due date in the message', async () => {
      const budi = await recordCustomer({ nama: 'Budi', telepon: '0812-5550-101' }, ctx)
      await bon(budi, 100000, 20)
      await bon(budi, 50000, 25)
      renderDetail(budi)

      const link = await screen.findByRole('link', { name: 'Kirim pengingat' })
      expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/628125550101\?text=/)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      const pesan = pesanDari(link)
      expect(pesan).toContain('Budi')
      expect(pesan).toContain('total tagihan Rp 150.000 (2 nota)')
      expect(pesan).toContain('yang terdekat jatuh tempo pada')
    })

    it('says the nota is already overdue when it is', async () => {
      const budi = await recordCustomer({ nama: 'Budi', telepon: '0812-5550-101' }, ctx)
      await bon(budi, 100000, -3)
      renderDetail(budi)
      expect(pesanDari(await screen.findByRole('link', { name: 'Kirim pengingat' }))).toContain('sudah lewat jatuh tempo sejak')
    })

    it('without a phone number it opens the customer form, prefilled, asking for a WhatsApp number', async () => {
      const budi = await recordCustomer({ nama: 'Budi', alamat: 'Jl. Mawar 1' }, ctx)
      await bon(budi, 100000, 10)
      const user = userEvent.setup()
      renderDetail(budi)

      expect(screen.queryByRole('link', { name: 'Kirim pengingat' })).toBeNull()
      await user.click(await screen.findByRole('button', { name: 'Kirim pengingat' }))

      expect(screen.getByRole('dialog', { name: 'Ubah pelanggan' })).toBeInTheDocument()
      expect(screen.getByText('Tambahkan nomor WhatsApp dulu.')).toBeInTheDocument()
      expect(screen.getByLabelText('Nama')).toHaveValue('Budi')
      expect(screen.getByLabelText('Alamat')).toHaveValue('Jl. Mawar 1')
    })

    it('saving a number turns the button into the WhatsApp link, and keeps the terms of the customer', async () => {
      const budi = await recordCustomer({ nama: 'Budi', termynHari: 14 }, ctx)
      await bon(budi, 100000, 10)
      const user = userEvent.setup()
      renderDetail(budi)

      await user.click(await screen.findByRole('button', { name: 'Kirim pengingat' }))
      await user.type(screen.getByLabelText('Telepon'), '0812-5550-101')
      await user.click(screen.getByRole('button', { name: 'Simpan' }))

      const link = await screen.findByRole('link', { name: 'Kirim pengingat' })
      expect(link.getAttribute('href')).toContain('https://wa.me/628125550101')
      expect(await db.customersProj.get(budi)).toMatchObject({ telepon: '0812-5550-101', termynHari: 14 })
    })

    it('a number that cannot be a WhatsApp number is treated as missing, with the old text to fix', async () => {
      const budi = await recordCustomer({ nama: 'Budi', telepon: '0812' }, ctx)
      await bon(budi, 100000, 10)
      const user = userEvent.setup()
      renderDetail(budi)

      await user.click(await screen.findByRole('button', { name: 'Kirim pengingat' }))

      expect(screen.getByLabelText('Telepon')).toHaveValue('0812')
    })

    it('a customer this device does not know yet gets named in the same form', async () => {
      await bon('belum-sinkron', 100000, 10)
      const user = userEvent.setup()
      renderDetail('belum-sinkron')

      expect(await screen.findByRole('heading', { level: 1, name: 'Pelanggan tidak dikenal' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Kirim pengingat' }))
      expect(screen.getByLabelText('Nama')).toHaveValue('')
      await user.type(screen.getByLabelText('Nama'), 'Toko Maju')
      await user.type(screen.getByLabelText('Telepon'), '0813-5550-202')
      await user.click(screen.getByRole('button', { name: 'Simpan' }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Toko Maju' })).toBeInTheDocument()
      expect(await screen.findByRole('link', { name: 'Kirim pengingat' })).toBeInTheDocument()
    })
  })

  describe('Nama toko', () => {
    const pesanDari = (link: HTMLElement) => new URL(link.getAttribute('href') as string).searchParams.get('text') as string
    const budi = async () => {
      const id = await recordCustomer({ nama: 'Budi', telepon: '0812-5550-101' }, ctx)
      await bon(id, 100000, 10)
      return id
    }

    it('says the message does not name the shop yet, and offers to set it', async () => {
      renderDetail(await budi())
      expect(await screen.findByText('Pesan belum menyebut nama toko.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Atur nama toko' })).toBeInTheDocument()
      expect(pesanDari(await screen.findByRole('link', { name: 'Kirim pengingat' }))).not.toContain('Kami dari')
    })

    it('setting the name updates the line and puts the name into the WhatsApp message', async () => {
      const user = userEvent.setup()
      renderDetail(await budi())

      await user.click(await screen.findByRole('button', { name: 'Atur nama toko' }))
      await user.type(screen.getByRole('textbox', { name: 'Nama toko' }), 'Toko Maju')
      await user.click(screen.getByRole('button', { name: 'Simpan' }))

      // The name is bold, so the sentence is split across elements: read its combined text.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Ubah' }).parentElement).toHaveTextContent('Pesan dikirim atas nama Toko Maju.'))
      expect(screen.getByRole('button', { name: 'Ubah' })).toBeInTheDocument()
      expect(pesanDari(screen.getByRole('link', { name: 'Kirim pengingat' }))).toContain('Kami dari Toko Maju mengingatkan')
      expect(await db.tokoProj.get('toko')).toMatchObject({ nama: 'Toko Maju' })
    })

    it('an existing name is prefilled to change, and clearing it goes back to the unset line', async () => {
      await aturNamaToko({ nama: 'Toko Maju' }, ctx)
      const user = userEvent.setup()
      renderDetail(await budi())

      await user.click(await screen.findByRole('button', { name: 'Ubah' }))
      expect(screen.getByRole('textbox', { name: 'Nama toko' })).toHaveValue('Toko Maju')
      await user.clear(screen.getByRole('textbox', { name: 'Nama toko' }))
      await user.click(screen.getByRole('button', { name: 'Simpan' }))

      expect(await screen.findByText('Pesan belum menyebut nama toko.')).toBeInTheDocument()
      expect(pesanDari(screen.getByRole('link', { name: 'Kirim pengingat' }))).not.toContain('Kami dari')
    })
  })
})


describe('PiutangDetail: catatan pengingat', () => {
  const tapPengingat = async (user: ReturnType<typeof userEvent.setup>) => {
    const link = await screen.findByRole('link', { name: 'Kirim pengingat' })
    link.addEventListener('click', e => e.preventDefault()) // jsdom would try to open the tab
    await user.click(link)
  }

  it('says nothing about reminders before the first one', async () => {
    const budi = await recordCustomer({ nama: 'Budi', telepon: '0812-5550-101' }, ctx)
    await bon(budi, 100000, 20)
    renderDetail(budi)
    await screen.findByRole('link', { name: 'Kirim pengingat' })
    expect(screen.queryByText(/Terakhir diingatkan/)).toBeNull()
  })

  it('notes each tap on Kirim pengingat and shows when and how many times', async () => {
    const user = userEvent.setup()
    const budi = await recordCustomer({ nama: 'Budi', telepon: '0812-5550-101' }, ctx)
    await bon(budi, 100000, 20)
    renderDetail(budi)

    await tapPengingat(user)
    expect(await screen.findByText(/Terakhir diingatkan .* \(1 kali\)/)).toBeInTheDocument()
    expect(await db.events.where('type').equals('ReminderSent').count()).toBe(1)

    await tapPengingat(user)
    expect(await screen.findByText(/\(2 kali\)/)).toBeInTheDocument()
  })

  it('does not note anything when there is no number and the button only asks for one', async () => {
    const user = userEvent.setup()
    const budi = await recordCustomer({ nama: 'Budi' }, ctx)
    await bon(budi, 100000, 20)
    renderDetail(budi)
    await user.click(await screen.findByRole('button', { name: 'Kirim pengingat' }))
    expect(await db.events.where('type').equals('ReminderSent').count()).toBe(0)
  })
})
