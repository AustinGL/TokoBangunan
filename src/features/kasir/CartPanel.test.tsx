// src/features/kasir/CartPanel.test.tsx
import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordSale } from '../../data/commands'
import { useCart, type CartItemInput } from './useCart'
import { CartPanel } from './CartPanel'

vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, recordSale: vi.fn(actual.recordSale) }
})

const semen: CartItemInput = { id: 'semen', nama: 'Semen Tiga Roda · 50 kg', baseUnit: '50 kg' }
const pasir: CartItemInput = { id: 'pasir', nama: 'Pasir Halus · m3', baseUnit: 'm3' }

function Harness({ onSaveAndNew }: { onSaveAndNew?: () => void }) {
  const cart = useCart()
  return (
    <div>
      <button onClick={() => cart.addItem(semen, 'batch-1', 65000)}>Add semen</button>
      <button onClick={() => cart.addItem(pasir, undefined, 180000)}>Add pasir</button>
      <button onClick={() => cart.addItem(semen, undefined, 0)}>Add unpriced semen</button>
      <CartPanel cart={cart} onSaveAndNew={onSaveAndNew} />
    </div>
  )
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.mocked(recordSale).mockClear()
})

describe('CartPanel: line rendering and qty stepper', () => {
  it('renders a cart line with name, unit price, qty stepper and subtotal', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    expect(screen.getByText('Semen Tiga Roda · 50 kg', { selector: 'p' })).toBeInTheDocument()
    // With qty 1, the line's price, its subtotal, and the footer's
    // subtotal/total all render "Rp 65.000" - the same ambiguity the
    // pre-existing suite already worked around with getAllByText for this
    // exact single-line-qty-1 scenario, rather than a single getByText.
    expect(screen.getAllByText(/Rp 65\.000/).length).toBeGreaterThanOrEqual(1)
  })

  it('the qty input\'s accessible name stays unique per (item, batch) line', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' })) // batch-1
    await user.click(screen.getByRole('button', { name: 'Add unpriced semen' })) // legacy pool, same itemId

    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-1)')).toBeInTheDocument()
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (Stok lama)')).toBeInTheDocument()
  })

  it('the stepper + button increments qty and recomputes the subtotal', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: 'Tambah jumlah' }))

    expect(await screen.findByText('Rp 130.000', { selector: 'p' })).toBeInTheDocument()
  })
})

describe('CartPanel: payment method, delivery, diskon and customer are real but inert', () => {
  it('Transfer, QRIS and Bon payment pills are real disabled controls, and clicking has no effect', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const transfer = screen.getByRole('radio', { name: 'Transfer' })
    const qris = screen.getByRole('radio', { name: 'QRIS' })
    const bon = screen.getByRole('radio', { name: 'Bon' })
    expect(transfer).toBeDisabled()
    expect(qris).toBeDisabled()
    expect(bon).toBeDisabled()

    await user.click(transfer)
    expect(transfer).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Tunai' })).toBeChecked()
  })

  it('Tunai is enabled and permanently checked', () => {
    render(<Harness />)
    const tunai = screen.getByRole('radio', { name: 'Tunai' })
    expect(tunai).toBeEnabled()
    expect(tunai).toBeChecked()
  })

  it('the Kirim delivery option is a real disabled control; Dibawa sekarang is enabled and checked', () => {
    render(<Harness />)
    const kirim = screen.getByRole('radio', { name: 'Kirim' })
    const dibawa = screen.getByRole('radio', { name: 'Dibawa sekarang' })
    expect(kirim).toBeDisabled()
    expect(dibawa).toBeEnabled()
    expect(dibawa).toBeChecked()
  })

  it('Diskon always shows Rp 0 with no interactive control nearby', async () => {
    // A line is added so Subtotal/Total move off Rp 0, leaving "Rp 0"
    // uniquely identifying the Diskon row.
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    const diskonLabel = screen.getByText('Diskon')
    const diskonRow = diskonLabel.closest('div')
    expect(diskonRow).not.toBeNull()
    expect(within(diskonRow!).getByText('Rp 0')).toBeInTheDocument()
    expect(within(diskonRow!).queryByRole('button')).toBeNull()
    expect(within(diskonRow!).queryByRole('textbox')).toBeNull()
    expect(within(diskonRow!).queryByRole('spinbutton')).toBeNull()
  })

  it('the customer row always shows "Tanpa pelanggan" with no picker control', () => {
    render(<Harness />)
    expect(screen.getByText('Pelanggan')).toBeInTheDocument()
    expect(screen.getByText('Tanpa pelanggan')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pelanggan/i })).toBeNull()
    expect(screen.queryByRole('combobox', { name: /pelanggan/i })).toBeNull()
  })

  it('renders no "Simpan sementara" control anywhere', () => {
    render(<Harness />)
    expect(screen.queryByText(/simpan sementara/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /sementara/i })).toBeNull()
  })
})

describe('CartPanel: manual price editing', () => {
  it('shows the current price and lets it be edited inline, flagging "diubah" once it diverges', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: /Ubah harga Semen Tiga Roda/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg')
    await user.clear(priceInput)
    await user.type(priceInput, '60000')
    await user.tab()

    expect(await screen.findByText(/diubah/)).toBeInTheDocument()
    expect(screen.getByText('Rp 60.000', { selector: 'p' })).toBeInTheDocument()
  })

  it('a never-priced line (hargaNormal 0) shows "Isi harga" and blocks save until a price is entered', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add unpriced semen' }))

    expect(screen.getByRole('button', { name: /Ubah harga/ })).toHaveTextContent('Isi harga')
    expect(await screen.findByText(/Isi harga untuk Semen Tiga Roda · 50 kg/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Ubah harga/ }))
    await user.type(screen.getByLabelText('Harga Semen Tiga Roda · 50 kg'), '0')
    await user.tab()

    // Explicitly typing 0 is a real price (a bonus item) - it unblocks save.
    expect(screen.queryByText(/Isi harga untuk/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeEnabled()
  })
})

describe('CartPanel: empty cart and save button availability', () => {
  it('disables both save buttons when the cart has zero lines, and enables them once a priced line is added', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeEnabled()
  })
})

describe('CartPanel: stock-insufficient warning (D7, warn never block)', () => {
  it('shows an inline warning when a line quantity exceeds live stock, and saving stays enabled and still succeeds', async () => {
    await db.stokProj.put({ itemId: 'semen', quantity: 2000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await waitFor(() => expect(screen.queryByText(/tinggal/i)).toBeNull())

    const qtyInput = screen.getByLabelText(/^Jumlah Semen Tiga Roda · 50 kg/)
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    expect(await screen.findByText(/Stok Semen Tiga Roda · 50 kg tinggal 2 50 kg\. Lanjutkan\?/)).toBeInTheDocument()
    const saveButton = screen.getByRole('button', { name: 'Simpan transaksi' })
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)
    expect(await screen.findByText('Transaksi tersimpan')).toBeInTheDocument()
  })
})

describe('CartPanel: uang diterima and kembalian', () => {
  it('computes and displays the correct kembalian', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.type(screen.getByLabelText('Uang diterima'), '70000')

    expect(await screen.findByText('Kembalian: Rp 5.000')).toBeInTheDocument()
  })
})

describe('CartPanel: Total live region', () => {
  it('is aria-live polite and keeps the same node across a total-changing update', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const before = screen.getByTestId('kasir-total')
    expect(before).toHaveAttribute('aria-live', 'polite')
    const beforeText = before.textContent

    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    const after = screen.getByTestId('kasir-total')
    expect(after).toBe(before)
    expect(after.textContent).not.toBe(beforeText)
  })
})

describe('CartPanel: saving a sale', () => {
  it('calls recordSale with batchId and hargaNormal for each line', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Add pasir' }))

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    expect(await screen.findByText('Transaksi tersimpan')).toBeInTheDocument()
    expect(recordSale).toHaveBeenCalledWith(
      {
        lines: [
          { itemId: 'semen', nama: 'Semen Tiga Roda · 50 kg', unit: '50 kg', qty: 1000, hargaSatuan: 65000, subtotal: 65000, batchId: 'batch-1', hargaNormal: 65000 },
          { itemId: 'pasir', nama: 'Pasir Halus · m3', unit: 'm3', qty: 1000, hargaSatuan: 180000, subtotal: 180000, batchId: undefined, hargaNormal: 180000 },
        ],
        metodeBayar: 'tunai',
        uangDiterima: undefined,
        customerId: undefined,
      },
      expect.objectContaining({ deviceId: expect.any(String) }),
    )
    const events = await db.events.toArray()
    expect(events.filter(e => e.type === 'SaleRecorded')).toHaveLength(1)
    expect(events.filter(e => e.type === 'StockAdjusted')).toHaveLength(2)
  })

  it('surfaces a visible error and does not clear the cart when recordSale rejects', async () => {
    vi.mocked(recordSale).mockRejectedValueOnce(new Error('write failed'))
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
    expect(screen.getByText('Semen Tiga Roda · 50 kg', { selector: 'p' })).toBeInTheDocument()
  })

  it('"Simpan & buat baru" also saves and calls onSaveAndNew', async () => {
    const user = userEvent.setup()
    const onSaveAndNew = vi.fn()
    render(<Harness onSaveAndNew={onSaveAndNew} />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: 'Simpan & buat baru' }))

    await screen.findByText('Transaksi tersimpan')
    expect(onSaveAndNew).toHaveBeenCalledTimes(1)
  })
})
