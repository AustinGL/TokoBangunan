import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordSale } from '../../data/commands'
import { useCart, type CartItemInput } from './useCart'
import { CartPanel } from './CartPanel'

// recordSale is wrapped as a spy over its real implementation, so every
// existing test still writes through to fake-indexeddb as before; only the
// "recordSale fails" test overrides it for a single call. Same pattern as
// ItemList.test.tsx's recordItem mock.
vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, recordSale: vi.fn(actual.recordSale) }
})

const semen: CartItemInput = { id: 'semen', nama: 'Semen Tiga Roda', baseUnit: 'sak', hargaEceran: 52000 }
const pasir: CartItemInput = { id: 'pasir', nama: 'Pasir Halus', baseUnit: 'm3', hargaEceran: 180000 }

/**
 * CartPanel takes useCart's result as a prop rather than owning cart state
 * itself, so tests exercise it the way Kasir.tsx really would: a live
 * useCart hook feeding a real CartPanel, with a couple of harness buttons
 * standing in for ProductGrid's "add to cart" clicks.
 */
function Harness({ onSaveAndNew }: { onSaveAndNew?: () => void }) {
  const cart = useCart()
  return (
    <div>
      <button onClick={() => cart.addItem(semen)}>Add semen</button>
      <button onClick={() => cart.addItem(pasir)}>Add pasir</button>
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

    // Scoped by selector: the item name also appears as screen-reader-only
    // text inside the qty input's own label, which is a separate, correct
    // occurrence (unique per-line accessible name), not the line's name row.
    expect(screen.getByText('Semen Tiga Roda', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('Rp 52.000 / sak')).toBeInTheDocument()
    // qty 1: subtotal equals the unit price.
    expect(screen.getAllByText('Rp 52.000').length).toBeGreaterThanOrEqual(1)
  })

  it('gives the stepper buttons the 44px touch-target utility classes and the required aria-labels', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    const decrement = screen.getByRole('button', { name: 'Kurangi jumlah' })
    const increment = screen.getByRole('button', { name: 'Tambah jumlah' })
    expect(decrement).toHaveClass('min-h-tap', 'min-w-tap')
    expect(increment).toHaveClass('min-h-tap', 'min-w-tap')
  })

  it('the qty input has a visible label and typing a value updates the line via setQtyWhole', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda')
    expect(qtyInput).toBeInTheDocument()
    // "Jumlah" itself is visible text in the label, not screen-reader-only.
    expect(screen.getByText('Jumlah')).toBeInTheDocument()

    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    // 52000 * 5 = 260000. With one line, subtotal/total in the footer equal
    // the line's own subtotal too, so this asserts on the line row
    // specifically (the bold, tabular-nums <p>), not just "somewhere".
    expect(await screen.findByText('Rp 260.000', { selector: 'p' })).toBeInTheDocument()
  })

  it('the stepper + button increments qty and recomputes the subtotal', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: 'Tambah jumlah' }))

    // qty 2: 52000 * 2 = 104000.
    expect(await screen.findByText('Rp 104.000', { selector: 'p' })).toBeInTheDocument()
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

describe('CartPanel: empty cart and save button availability', () => {
  it('disables both save buttons when the cart has zero lines, and enables them once a line is added', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('Keranjang kosong. Tambahkan barang untuk mulai.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Simpan & buat baru' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    expect(screen.queryByText('Keranjang kosong. Tambahkan barang untuk mulai.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Simpan & buat baru' })).toBeEnabled()
  })

  it('shows the item-count pill in the header', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('0')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Add pasir' }))

    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

describe('CartPanel: stock-insufficient warning (D7, warn never block)', () => {
  it('shows an inline warning when a line quantity exceeds live stock, and saving stays enabled and still succeeds', async () => {
    // Live stock: 2 sak (2000 milli-units). Adding semen then raising qty to
    // 5 exceeds it.
    await db.stokProj.put({ itemId: 'semen', quantity: 2000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' })
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    // qty 1 <= stock 2: no warning. findBy/waitFor rather than a bare
    // synchronous query, since the stock live query resolves asynchronously.
    await screen.findByText('Semen Tiga Roda', { selector: 'p' })
    await waitFor(() => expect(screen.queryByText(/tinggal/i)).toBeNull())

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    expect(await screen.findByText('Stok Semen Tiga Roda tinggal 2 sak. Lanjutkan?')).toBeInTheDocument()

    const saveButton = screen.getByRole('button', { name: 'Simpan transaksi' })
    expect(saveButton).toBeEnabled()
    await user.click(saveButton)

    expect(await screen.findByText('Transaksi tersimpan')).toBeInTheDocument()
    expect(recordSale).toHaveBeenCalledTimes(1)
  })
})

describe('CartPanel: uang diterima and kembalian', () => {
  it('computes and displays the correct kembalian', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    // Total is 52000 (qty 1 * 52000).

    await user.type(screen.getByLabelText('Uang diterima'), '60000')

    // kembalian = uangDiterima - total = 60000 - 52000 = 8000.
    expect(await screen.findByText('Kembalian: Rp 8.000')).toBeInTheDocument()
  })

  it('shows a negative, clearly-marked kembalian rather than hiding an insufficient payment (judgment call, see report)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.type(screen.getByLabelText('Uang diterima'), '10000')

    // kembalian = 10000 - 52000 = -42000. formatRupiah prefixes a literal
    // "- " sign, so the negative is carried by text, not color alone.
    const kembalian = await screen.findByText('Kembalian: - Rp 42.000')
    expect(kembalian).toHaveClass('text-danger')
  })

  it('omits uangDiterima from the sale entirely when left blank', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    await screen.findByText('Transaksi tersimpan')
    expect(recordSale).toHaveBeenCalledWith(
      expect.objectContaining({ uangDiterima: undefined }),
      expect.anything(),
    )
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
  it('calls recordSale with the cart shape, clears the cart, and shows the "Transaksi tersimpan" confirmation', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Add pasir' }))

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    expect(await screen.findByText('Transaksi tersimpan')).toBeInTheDocument()
    expect(recordSale).toHaveBeenCalledTimes(1)
    expect(recordSale).toHaveBeenCalledWith(
      {
        lines: [
          { itemId: 'semen', nama: 'Semen Tiga Roda', unit: 'sak', qty: 1000, hargaSatuan: 52000, subtotal: 52000 },
          { itemId: 'pasir', nama: 'Pasir Halus', unit: 'm3', qty: 1000, hargaSatuan: 180000, subtotal: 180000 },
        ],
        metodeBayar: 'tunai',
        uangDiterima: undefined,
        customerId: undefined,
      },
      expect.objectContaining({ deviceId: expect.any(String) }),
    )

    // The cart is empty again, and one SaleRecorded plus two StockAdjusted
    // events landed atomically (real fake-indexeddb, not a mock of the
    // event store).
    expect(screen.getByText('Keranjang kosong. Tambahkan barang untuk mulai.')).toBeInTheDocument()
    const events = await db.events.toArray()
    expect(events.filter(e => e.type === 'SaleRecorded')).toHaveLength(1)
    expect(events.filter(e => e.type === 'StockAdjusted')).toHaveLength(2)
  })

  it('"Simpan & buat baru" also saves and calls onSaveAndNew, unlike plain "Simpan transaksi"', async () => {
    const user = userEvent.setup()
    const onSaveAndNew = vi.fn()
    render(<Harness onSaveAndNew={onSaveAndNew} />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: 'Simpan & buat baru' }))

    await screen.findByText('Transaksi tersimpan')
    expect(onSaveAndNew).toHaveBeenCalledTimes(1)
  })

  it('does not call onSaveAndNew for a plain "Simpan transaksi"', async () => {
    const user = userEvent.setup()
    const onSaveAndNew = vi.fn()
    render(<Harness onSaveAndNew={onSaveAndNew} />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    await screen.findByText('Transaksi tersimpan')
    expect(onSaveAndNew).not.toHaveBeenCalled()
  })

  it('surfaces a visible error and does not clear the cart when recordSale rejects', async () => {
    vi.mocked(recordSale).mockRejectedValueOnce(new Error('write failed'))
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
    // The cart is untouched: the line is still there, not cleared.
    expect(screen.getByText('Semen Tiga Roda', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByText('Transaksi tersimpan')).toBeNull()
    expect(await db.events.toArray()).toHaveLength(0)
  })
})
