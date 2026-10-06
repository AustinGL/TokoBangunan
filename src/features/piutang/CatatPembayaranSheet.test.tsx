import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordSale } from '../../data/commands'
import { fixedClock, systemClock } from '../../domain/clock'
import { isoDateDaysAgo, dateAtLocalNoon, todayIsoDate } from '../../domain/tanggal'
import { ringkas } from '../../domain/kalender'
import { bukaKalender, keTanggal, pilihTanggal } from '../../test-utils/pickDate'
import { shortNota } from '../../domain/nota'
import { CatatPembayaranSheet } from './CatatPembayaranSheet'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const ctx = { clock: systemClock, deviceId: 'laptop' }
const bon = (total: number, jatuhTempoHari: number) => recordSale({
  lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
  metodeBayar: 'bon', customerId: 'c1', jatuhTempo: isoDateDaysAgo(systemClock, jatuhTempoHari),
}, ctx)

describe('CatatPembayaranSheet: one nota', () => {
  it('starts at the nota\'s sisa and records the payment', async () => {
    const saleId = await bon(100000, 10)
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CatatPembayaranSheet open onClose={onClose} mode={{ kind: 'nota', saleId, nomor: shortNota(saleId), sisa: 100000, occurredAt: new Date().toISOString() }} />)

    expect(screen.getByLabelText('Jumlah dibayar')).toHaveValue('100.000')
    await user.clear(screen.getByLabelText('Jumlah dibayar'))
    await user.type(screen.getByLabelText('Jumlah dibayar'), '40000')
    await user.type(screen.getByLabelText('Catatan'), 'cicilan 1')
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.paymentsProj.toArray()).toEqual([expect.objectContaining({ saleId, jumlah: 40000, catatan: 'cicilan 1' })])
  })

  it('the Lunas button fills the whole sisa', async () => {
    const saleId = await bon(100000, 10)
    const user = userEvent.setup()
    render(<CatatPembayaranSheet open onClose={vi.fn()} mode={{ kind: 'nota', saleId, nomor: '#X', sisa: 60000, occurredAt: new Date().toISOString() }} />)

    await user.clear(screen.getByLabelText('Jumlah dibayar'))
    await user.click(screen.getByRole('button', { name: 'Lunas' }))

    expect(screen.getByLabelText('Jumlah dibayar')).toHaveValue('60.000')
  })

  it('rejects an empty, zero or too-large amount inline and writes nothing', async () => {
    const saleId = await bon(100000, 10)
    const user = userEvent.setup()
    render(<CatatPembayaranSheet open onClose={vi.fn()} mode={{ kind: 'nota', saleId, nomor: '#X', sisa: 100000, occurredAt: new Date().toISOString() }} />)

    await user.clear(screen.getByLabelText('Jumlah dibayar'))
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))
    expect(screen.getByText('Jumlah wajib diisi dan lebih dari 0.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Jumlah dibayar'), '100001')
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))
    expect(screen.getByText('Jumlah melebihi sisa Rp 100.000.')).toBeInTheDocument()

    expect(await db.paymentsProj.count()).toBe(0)
  })

  it('shows a visible error when the write fails', async () => {
    const user = userEvent.setup()
    render(<CatatPembayaranSheet open onClose={vi.fn()} mode={{ kind: 'nota', saleId: 'tidak-ada', nomor: '#X', sisa: 1000, occurredAt: new Date().toISOString() }} />)
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pembayaran gagal disimpan. Coba lagi.')
  })
})

describe('CatatPembayaranSheet: oldest first', () => {
  it('previews the split per nota and records one payment each', async () => {
    const lama = await recordSale({
      lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: 70000, subtotal: 70000 }],
      metodeBayar: 'bon', customerId: 'c1', jatuhTempo: isoDateDaysAgo(systemClock, 3),
    }, { clock: fixedClock('2026-09-20T07:00:00.000Z'), deviceId: 'laptop' })
    const baru = await bon(100000, -20) // due in 20 days: the later of the two
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <CatatPembayaranSheet
        open onClose={onClose}
        mode={{
          kind: 'terlama', customerId: 'c1', totalSisa: 170000,
          nota: [
            { saleId: baru, jatuhTempo: isoDateDaysAgo(systemClock, -20), occurredAt: '2026-10-03T07:00:00.000Z', sisa: 100000 },
            { saleId: lama, jatuhTempo: isoDateDaysAgo(systemClock, 3), occurredAt: '2026-09-20T07:00:00.000Z', sisa: 70000 },
          ],
        }}
      />,
    )

    await user.type(screen.getByLabelText('Jumlah dibayar'), '120000')

    const bagi = screen.getByRole('list', { name: 'Pembagian pembayaran' })
    const rows = within(bagi).getAllByRole('listitem').map(li => li.textContent)
    expect(rows[0]).toContain(shortNota(lama))
    expect(rows[0]).toContain('70.000')
    expect(rows[1]).toContain(shortNota(baru))
    expect(rows[1]).toContain('50.000')

    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const payments = await db.paymentsProj.toArray()
    expect(payments.find(p => p.saleId === lama)?.jumlah).toBe(70000)
    expect(payments.find(p => p.saleId === baru)?.jumlah).toBe(50000)
  })

  it('rejects more than the total owed', async () => {
    const user = userEvent.setup()
    render(
      <CatatPembayaranSheet
        open onClose={vi.fn()}
        mode={{ kind: 'terlama', customerId: 'c1', totalSisa: 100000, nota: [{ saleId: 's1', jatuhTempo: '2026-10-20', occurredAt: '2026-10-01T07:00:00.000Z', sisa: 100000 }] }}
      />,
    )
    await user.type(screen.getByLabelText('Jumlah dibayar'), '100001')
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))
    expect(screen.getByText('Jumlah melebihi sisa Rp 100.000.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Pembagian pembayaran' })).toBeNull()
  })
})

describe('CatatPembayaranSheet: tanggal bayar', () => {
  const tetap = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })
  const bonTetap = (total: number, jatuhTempo: string, iso: string) => recordSale({
    lines: [{ itemId: 'semen', nama: 'Semen', unit: 'sak', qty: 1000, hargaSatuan: total, subtotal: total }],
    metodeBayar: 'bon', customerId: 'c1', jatuhTempo,
  }, tetap(iso))
  const NOTA = '2026-09-01T12:00:00.000Z'
  const hariIni = () => todayIsoDate(systemClock)

  it('starts at today', async () => {
    const saleId = await bonTetap(100000, '2026-09-20', NOTA)
    render(<CatatPembayaranSheet open onClose={vi.fn()} mode={{ kind: 'nota', saleId, nomor: '#X', sisa: 100000, occurredAt: NOTA }} />)
    expect(screen.getByRole('button', { name: /Tanggal bayar/ })).toHaveTextContent(ringkas(hariIni()))
  })

  it('a payment dated an earlier day is saved on that day', async () => {
    const saleId = await bonTetap(100000, '2026-09-20', NOTA)
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CatatPembayaranSheet open onClose={onClose} mode={{ kind: 'nota', saleId, nomor: '#X', sisa: 100000, occurredAt: NOTA }} />)

    await pilihTanggal(user, /Tanggal bayar/, '2026-09-10')
    expect(screen.getByRole('button', { name: /Tanggal bayar/ })).toHaveTextContent('10 Sep 2026')
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect((await db.paymentsProj.toArray())[0].occurredAt).toBe(dateAtLocalNoon('2026-09-10').toISOString())
  })

  it('leaving the date alone records the payment now, as before', async () => {
    const saleId = await bonTetap(100000, '2026-09-20', NOTA)
    const onClose = vi.fn()
    const user = userEvent.setup()
    const sebelum = Date.now()
    render(<CatatPembayaranSheet open onClose={onClose} mode={{ kind: 'nota', saleId, nomor: '#X', sisa: 100000, occurredAt: NOTA }} />)
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const bayar = (await db.paymentsProj.toArray())[0]
    expect(new Date(bayar.occurredAt).getTime()).toBeGreaterThanOrEqual(sebelum)
    expect(bayar.occurredAt).toBe(bayar.recordedAt)
  })

  it('cannot be set before the nota: the nota day is the first one on offer', async () => {
    const saleId = await bonTetap(100000, '2026-09-20', NOTA)
    const user = userEvent.setup()
    render(<CatatPembayaranSheet open onClose={vi.fn()} mode={{ kind: 'nota', saleId, nomor: '#X', sisa: 100000, occurredAt: NOTA }} />)

    const kartu = await bukaKalender(user, /Tanggal bayar/)
    expect(await keTanggal(user, '2026-09-01')).toBeEnabled()
    expect(within(kartu).getByRole('heading')).toHaveTextContent('September 2026')
    expect(within(kartu).getByRole('button', { name: 'Bulan sebelumnya' })).toBeDisabled()
  })

  it('oldest first: only the notas the amount reaches limit the date, and a date that becomes too early is refused', async () => {
    const lama = await bonTetap(70000, '2026-09-10', NOTA)
    const baru = await bonTetap(100000, '2026-09-25', '2026-09-20T12:00:00.000Z')
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <CatatPembayaranSheet
        open onClose={onClose}
        mode={{
          kind: 'terlama', customerId: 'c1', totalSisa: 170000,
          nota: [
            { saleId: baru, jatuhTempo: '2026-09-25', occurredAt: '2026-09-20T12:00:00.000Z', sisa: 100000 },
            { saleId: lama, jatuhTempo: '2026-09-10', occurredAt: NOTA, sisa: 70000 },
          ],
        }}
      />,
    )

    // Nothing typed yet: the oldest nota is the one that would be paid, so the 5th is fine.
    await pilihTanggal(user, /Tanggal bayar/, '2026-09-05')
    expect(screen.queryByText('Tanggal bayar tidak boleh sebelum tanggal nota.')).toBeNull()

    // An amount that reaches the nota from the 20th: the 5th is now too early.
    await user.type(screen.getByLabelText('Jumlah dibayar'), '120000')
    expect(screen.getByText('Tanggal bayar tidak boleh sebelum tanggal nota.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(await db.paymentsProj.count()).toBe(0)

    // Moving the date to the 22nd clears it, and every payment written carries that day.
    await pilihTanggal(user, /Tanggal bayar/, '2026-09-22')
    expect(screen.queryByText('Tanggal bayar tidak boleh sebelum tanggal nota.')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Simpan pembayaran' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const bayar = await db.paymentsProj.toArray()
    expect(bayar).toHaveLength(2)
    expect(bayar.every(p => p.occurredAt === dateAtLocalNoon('2026-09-22').toISOString())).toBe(true)
  })
})
