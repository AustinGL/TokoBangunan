import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordSale, type RecordSaleInput } from '../../data/commands'
import { fixedClock } from '../../domain/clock'
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
