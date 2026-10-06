import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordSale, recordCustomer, catatPembayaran, type RecordSaleInput } from '../../data/commands'
import { fixedClock } from '../../domain/clock'
import { createEvent } from '../../domain/events'
import { appendEvents } from '../../data/eventStore'
import { shortNota } from '../../domain/nota'
import { SaleDetail } from './SaleDetail'

// voidSale is wrapped as a spy over its real implementation, so every
// existing test still writes through to fake-indexeddb as before; only the
// "rejected voidSale" test overrides it for a single call. Same pattern
// CartPanel.test.tsx already established for recordSale.
vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, voidSale: vi.fn(actual.voidSale) }
})

const at = (iso: string) => ({ clock: fixedClock(iso), deviceId: 'laptop' })

const cart: RecordSaleInput = {
  lines: [
    { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 3000, hargaSatuan: 52000, subtotal: 156000 },
    { itemId: 'pasir', nama: 'Pasir', unit: 'm3', qty: 2000, hargaSatuan: 180000, subtotal: 360000 },
  ],
  metodeBayar: 'tunai',
  uangDiterima: 600000,
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  const { voidSale } = await import('../../data/commands')
  // mockClear only, never mockReset/mockImplementation: the mock factory
  // above already wraps the real voidSale as this mock's implementation,
  // and mockRejectedValueOnce (used by the "rejected voidSale" test below)
  // overrides only its next single call before falling back to that same
  // real implementation again.
  vi.mocked(voidSale).mockClear()
})

describe('SaleDetail: rendering', () => {
  it('shows the nota number, and writes a quantity as "3 × sak" so a unit starting with a number is never misread', async () => {
    const saleId = await recordSale({
      lines: [{ itemId: 'semen', nama: 'Semen Tiga Roda · 50 kg', unit: '50 kg', qty: 1000, hargaSatuan: 65000, subtotal: 65000 }],
      metodeBayar: 'tunai',
    }, at('2026-09-18T08:00:00.000Z'))

    render(<SaleDetail saleId={saleId} />)

    expect(await screen.findByText(shortNota(saleId))).toBeInTheDocument()
    // "1 50 kg" reads as 150 kg; "1 × 50 kg" cannot.
    expect(screen.getByText('1 × 50 kg')).toBeInTheDocument()
    expect(screen.queryByText('1 50 kg')).toBeNull()
  })

  it('renders all line items, amounts and status for an aktif sale', async () => {
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))

    render(<SaleDetail saleId={saleId} />)

    expect(await screen.findByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.getByText('Pasir')).toBeInTheDocument()
    expect(screen.getByText('Rp 156.000')).toBeInTheDocument()
    expect(screen.getByText('Rp 360.000')).toBeInTheDocument()
    // Total: 156000 + 360000 = 516000. diskon is always 0, so subtotal and
    // total both render this same string (two separate rows).
    expect(screen.getAllByText('Rp 516.000')).toHaveLength(2)
    expect(screen.getByText('Aktif')).toBeInTheDocument()
    // Kembalian: 600000 - 516000 = 84000.
    expect(screen.getByText('Rp 84.000')).toBeInTheDocument()
  })

  it('renders voidedAt/voidedReason and Batal status for a batal sale', async () => {
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    const { voidSale } = await import('../../data/commands')
    await voidSale(saleId, 'Salah input pelanggan', at('2026-09-18T09:00:00.000Z'))

    render(<SaleDetail saleId={saleId} />)

    expect(await screen.findByText('Batal')).toBeInTheDocument()
    expect(screen.getByText(/Alasan: Salah input pelanggan/)).toBeInTheDocument()
  })

  it('an already-batal sale renders with no Batalkan control at all', async () => {
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    const { voidSale } = await import('../../data/commands')
    await voidSale(saleId, 'Salah input', at('2026-09-18T09:00:00.000Z'))

    render(<SaleDetail saleId={saleId} />)

    await screen.findByText('Batal')
    expect(screen.queryByRole('button', { name: 'Batalkan' })).not.toBeInTheDocument()
  })
})

describe('SaleDetail: Cetak nota', () => {
  it('"Cetak nota" triggers window.print()', async () => {
    const user = userEvent.setup()
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    render(<SaleDetail saleId={saleId} />)
    await user.click(await screen.findByRole('button', { name: 'Cetak nota' }))

    expect(printSpy).toHaveBeenCalledTimes(1)
    printSpy.mockRestore()
  })
})

describe('SaleDetail: Batalkan flow', () => {
  it('clicking Batalkan reveals the confirm area with a required reason field', async () => {
    const user = userEvent.setup()
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))

    render(<SaleDetail saleId={saleId} />)
    await user.click(await screen.findByRole('button', { name: 'Batalkan' }))

    expect(screen.getByLabelText(/alasan pembatalan/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ya, batalkan' })).toBeInTheDocument()
  })

  it('submitting with an empty reason shows an inline error and does not call voidSale', async () => {
    const user = userEvent.setup()
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    const { voidSale } = await import('../../data/commands')

    render(<SaleDetail saleId={saleId} />)
    await user.click(await screen.findByRole('button', { name: 'Batalkan' }))
    await user.click(screen.getByRole('button', { name: 'Ya, batalkan' }))

    const alasanInput = screen.getByLabelText(/alasan pembatalan/i)
    const describedBy = alasanInput.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent(/wajib diisi/i)
    expect(voidSale).not.toHaveBeenCalled()
  })

  it('submitting with a reason calls commands.voidSale with the right arguments and the UI reflects batal status live', async () => {
    const user = userEvent.setup()
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    const { voidSale } = await import('../../data/commands')

    render(<SaleDetail saleId={saleId} />)
    await user.click(await screen.findByRole('button', { name: 'Batalkan' }))
    await user.type(screen.getByLabelText(/alasan pembatalan/i), 'Salah input')
    await user.click(screen.getByRole('button', { name: 'Ya, batalkan' }))

    await waitFor(() => {
      expect(voidSale).toHaveBeenCalledWith(saleId, 'Salah input', expect.objectContaining({ deviceId: expect.any(String) }))
    })

    // Live update, no manual refetch: the same render's DOM flips to Batal
    // once the real fake-indexeddb write's projection effect lands.
    await waitFor(() => {
      expect(screen.getByTestId('sale-status')).toHaveTextContent('Batal')
    }, { timeout: 3000 })
    expect(screen.queryByRole('button', { name: 'Batalkan' })).not.toBeInTheDocument()
  })

  it('a rejected voidSale surfaces a visible error and does not falsely show batal status', async () => {
    const user = userEvent.setup()
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    const { voidSale } = await import('../../data/commands')
    vi.mocked(voidSale).mockRejectedValueOnce(new Error('Transaksi sudah dibatalkan.'))

    render(<SaleDetail saleId={saleId} />)
    await user.click(await screen.findByRole('button', { name: 'Batalkan' }))
    await user.type(screen.getByLabelText(/alasan pembatalan/i), 'Salah input')
    await user.click(screen.getByRole('button', { name: 'Ya, batalkan' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal dibatalkan/i)
    // Scoped to the status pill itself (data-testid), not plain text: the
    // confirm area's own "Batal" cancel button is still on screen too, and
    // a plain getByText('Batal') would ambiguously match it.
    expect(screen.getByTestId('sale-status')).toHaveTextContent('Aktif')
  })
})

describe('SaleDetail: Bon', () => {
  const bonSale = async (extra: Partial<RecordSaleInput> = {}) => {
    const customerId = await recordCustomer({ nama: 'Budi Santoso' }, at('2026-10-01T07:00:00.000Z'))
    const saleId = await recordSale({
      lines: [{ itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 2000, hargaSatuan: 50000, subtotal: 100000 }],
      metodeBayar: 'bon', customerId, jatuhTempo: '2026-10-20', dibayarAwal: 20000, ...extra,
    }, at('2026-10-03T08:00:00.000Z'))
    return { saleId, customerId }
  }

  it('shows Bon as the method, with the customer, due date, down payment, payments and the remaining sisa', async () => {
    const { saleId } = await bonSale()
    await catatPembayaran({ saleId, jumlah: 30000, catatan: 'cicilan' }, at('2026-10-05T07:00:00.000Z'))

    render(<SaleDetail saleId={saleId} />)

    const blok = await screen.findByTestId('sale-bon')
    expect(screen.getByText('Bon')).toBeInTheDocument()
    expect(await within(blok).findByText('Budi Santoso')).toBeInTheDocument()
    expect(within(blok).getByText('20 Okt 2026')).toBeInTheDocument()
    expect(within(blok).getByText('Rp 20.000')).toBeInTheDocument() // down payment
    expect(within(blok).getByText('Rp 30.000')).toBeInTheDocument() // the payment
    expect(within(blok).getByText(/Sisa piutang/)).toBeInTheDocument()
    expect(within(blok).getByText('Rp 50.000')).toBeInTheDocument() // 100000 - 20000 - 30000
  })

  it('names a customer this device has not synced yet as "Pelanggan tidak dikenal"', async () => {
    const { saleId } = await bonSale({ customerId: 'belum-sinkron' })
    render(<SaleDetail saleId={saleId} />)
    expect(await within(await screen.findByTestId('sale-bon')).findByText('Pelanggan tidak dikenal')).toBeInTheDocument()
  })

  it('a tunai sale has no Bon block', async () => {
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    render(<SaleDetail saleId={saleId} />)
    await screen.findByText('Aktif')
    expect(screen.queryByTestId('sale-bon')).toBeNull()
    expect(screen.getByText('Tunai')).toBeInTheDocument()
  })

  it('Batalkan on a Bon that already has a payment shows the reason, and the sale stays aktif', async () => {
    const { saleId } = await bonSale()
    await catatPembayaran({ saleId, jumlah: 30000 }, at('2026-10-05T07:00:00.000Z'))
    const user = userEvent.setup()
    render(<SaleDetail saleId={saleId} />)

    await user.click(await screen.findByRole('button', { name: 'Batalkan' }))
    await user.type(screen.getByLabelText(/Alasan pembatalan/), 'salah input')
    await user.click(screen.getByRole('button', { name: 'Ya, batalkan' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sudah ada pembayaran Rp 30.000 untuk transaksi ini, jadi tidak bisa dibatalkan.')
    expect(screen.getByText('Aktif')).toBeInTheDocument()
  })

  it('Batalkan still shows the generic message for a failure that is not a refusal', async () => {
    const saleId = await recordSale(cart, at('2026-09-18T08:00:00.000Z'))
    const { voidSale } = await import('../../data/commands')
    vi.mocked(voidSale).mockRejectedValueOnce(new Error('IndexedDB blew up'))
    const user = userEvent.setup()
    render(<SaleDetail saleId={saleId} />)

    await user.click(await screen.findByRole('button', { name: 'Batalkan' }))
    await user.type(screen.getByLabelText(/Alasan pembatalan/), 'salah')
    await user.click(screen.getByRole('button', { name: 'Ya, batalkan' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Transaksi gagal dibatalkan. Coba lagi.')
  })

  describe('a cancelled Bon', () => {
    const bonSale = () => recordSale({
      lines: [{ itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 2000, hargaSatuan: 50000, subtotal: 100000 }],
      metodeBayar: 'bon', customerId: 'c1', jatuhTempo: '2026-10-20',
    }, at('2026-10-03T08:00:00.000Z'))

    it('shows no Sisa piutang once the nota is batal', async () => {
      const saleId = await bonSale()
      const { voidSale } = await import('../../data/commands')
      await voidSale(saleId, 'salah input', at('2026-10-04T08:00:00.000Z'))

      render(<SaleDetail saleId={saleId} />)

      await screen.findByText('Batal')
      expect(within(screen.getByTestId('sale-bon')).queryByText(/Sisa piutang/)).toBeNull()
      expect(screen.queryByText(/sudah diterima untuk transaksi yang dibatalkan/)).toBeNull()
    })

    it('flags money received against a nota that another device cancelled', async () => {
      const saleId = await bonSale()
      await catatPembayaran({ saleId, jumlah: 30000 }, at('2026-10-05T07:00:00.000Z'))
      // A SaleVoided pulled from a device that had not yet seen the payment: it bypasses voidSale's local guard.
      await appendEvents([createEvent('SaleVoided', { saleId, alasan: 'dibatalkan dari perangkat lain' }, at('2026-10-05T08:00:00.000Z'))])

      render(<SaleDetail saleId={saleId} />)

      expect(await screen.findByText('Pembayaran Rp 30.000 sudah diterima untuk transaksi yang dibatalkan. Cek apakah uangnya perlu dikembalikan.')).toBeInTheDocument()
      expect(within(screen.getByTestId('sale-bon')).queryByText(/Sisa piutang/)).toBeNull()
    })
  })
})

describe('SaleDetail: Transfer and QRIS', () => {
  it('names the method of a transfer sale and shows no Bon block', async () => {
    const saleId = await recordSale({ ...cart, uangDiterima: undefined, metodeBayar: 'transfer' }, at('2026-09-18T08:00:00.000Z'))
    render(<SaleDetail saleId={saleId} />)
    await screen.findByText('Aktif')
    expect(screen.getByText('Transfer')).toBeInTheDocument()
    expect(screen.queryByTestId('sale-bon')).toBeNull()
  })
})
