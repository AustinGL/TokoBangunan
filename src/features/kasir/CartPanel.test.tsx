// src/features/kasir/CartPanel.test.tsx
import 'fake-indexeddb/auto'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordSale } from '../../data/commands'
import { useCart, type CartItemInput } from './useCart'
import { CartPanel } from './CartPanel'
import type { Batch } from '../../domain/projections/batches'

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
      <button onClick={() => cart.addItem(semen, undefined, 65000)}>Add legacy semen</button>
      <button onClick={() => cart.addItem(semen, 'batch-2', 67000)}>Add semen batch-2</button>
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
    // PriceEdit's closed-state button is the only place "/ 50 kg" is
    // appended to the price, so this uniquely pins down the unit-price
    // label - the same "Rp X / unit" pattern the pre-existing suite used
    // for this exact assertion, rather than the bare amount, which (with
    // qty 1 and no diskon) also matches the line subtotal and the footer's
    // subtotal/total.
    expect(screen.getByText(/Rp 65\.000 \/ 50 kg/)).toBeInTheDocument()
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
  it('gives the price toggle button the 44px touch-target utility classes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    const toggle = screen.getByRole('button', { name: /Ubah harga Semen Tiga Roda/ })
    expect(toggle).toHaveClass('min-h-tap', 'min-w-tap')
  })

  it('shows the current price and lets it be edited inline, flagging "diubah" once it diverges', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: /Ubah harga Semen Tiga Roda/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch batch-1)')
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
    await user.type(screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (Stok lama)'), '0')
    await user.tab()

    // Explicitly typing 0 is a real price (a bonus item) - it unblocks save.
    expect(screen.queryByText(/Isi harga untuk/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeEnabled()
  })

  it('the price-edit control\'s accessible name stays unique per (item, batch) line, and still includes the visible price', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' })) // batch-1
    await user.click(screen.getByRole('button', { name: 'Add legacy semen' })) // legacy pool, same itemId

    const batchToggle = screen.getByRole('button', { name: /^Ubah harga Semen Tiga Roda · 50 kg \(batch batch-1\)/ })
    const legacyToggle = screen.getByRole('button', { name: /^Ubah harga Semen Tiga Roda · 50 kg \(Stok lama\)/ })
    expect(batchToggle).not.toBe(legacyToggle)
    // Label in name (WCAG 2.5.3): the visible price is part of the name,
    // not thrown away by an aria-label.
    expect(batchToggle).toHaveAccessibleName('Ubah harga Semen Tiga Roda · 50 kg (batch batch-1): Rp 65.000 / 50 kg')

    await user.click(legacyToggle)
    expect(screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (Stok lama)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Harga Semen Tiga Roda · 50 kg (batch batch-1)')).toBeNull()
  })

  it('the "(diubah, normal ...)" flag is part of the price-edit control\'s accessible name', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: /Ubah harga/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch batch-1)')
    await user.clear(priceInput)
    await user.type(priceInput, '60000')
    await user.tab()

    expect(await screen.findByRole('button', { name: /Ubah harga/ })).toHaveAccessibleName(
      'Ubah harga Semen Tiga Roda · 50 kg (batch batch-1): Rp 60.000 / 50 kg (diubah, normal Rp 65.000)',
    )
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

  it('two lines for the SAME item on DIFFERENT batches save as two separate RecordSaleLines, never merged into one', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' })) // batch-1
    await user.click(screen.getByRole('button', { name: 'Add legacy semen' })) // legacy pool, same itemId

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    expect(await screen.findByText('Transaksi tersimpan')).toBeInTheDocument()
    const [input] = vi.mocked(recordSale).mock.calls[0]
    expect(input.lines).toHaveLength(2)
    expect(input.lines.filter(l => l.itemId === 'semen')).toHaveLength(2)
    expect(input.lines.map(l => l.batchId)).toEqual(['batch-1', undefined])
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

const seedBatch = (overrides: Partial<Batch> & { batchId: string; itemId: string }) =>
  db.batchesProj.put({
    supplierId: 'sup-1', hargaBeli: 58000, hargaJual: 65000, diterima: 40000, sisa: 40000,
    tanggalBeli: '2026-09-02', metaUpdatedAt: '2026-09-02T07:00:00.000Z', metaUpdatedByEventId: 'e1',
    lastMovementAt: '2026-09-02T07:00:00.000Z', lastMovementEventId: 'e1',
    ...overrides,
  })

describe('CartPanel: batch chip', () => {
  it('shows "Stok lama" for a line added with no batch', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add unpriced semen' }))

    expect(await screen.findByText(/^Stok lama/)).toBeInTheDocument()
  })

  it('shows the batch\'s own tanggal, supplier and sisa for a line added with a real batch', async () => {
    await db.suppliersProj.put({ id: 'sup-1', nama: 'UD Sentosa', perluDilengkapi: false, updatedAt: '2026-09-02T07:00:00.000Z', updatedByEventId: 'e1' })
    await seedBatch({ batchId: 'batch-1', itemId: 'semen' })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    expect(await screen.findByText(/UD Sentosa/)).toBeInTheDocument()
    expect(screen.getByText(/sisa 40/)).toBeInTheDocument()
  })

  it('expanding the batch chip and choosing another batch calls changeBatch and keeps the manual price', async () => {
    await seedBatch({ batchId: 'batch-1', itemId: 'semen', tanggalBeli: '2026-09-02' })
    await seedBatch({ batchId: 'batch-2', itemId: 'semen', tanggalBeli: '2026-09-15', hargaJual: 67000 })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: /Ubah harga/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch batch-1)')
    await user.clear(priceInput)
    await user.type(priceInput, '63000')
    await user.tab()

    await user.click(await screen.findByRole('button', { name: /Ubah batch/ }))
    // Scoped to the batch radiogroup: the page also has the (always-present,
    // really disabled) payment-method and delivery native radios (Decision
    // 2/4), so an unscoped findAllByRole('radio') would pick those up too.
    const batchRadiogroup = await screen.findByRole('radiogroup', { name: /Pilih batch/ })
    const radios = within(batchRadiogroup).getAllByRole('radio')
    await user.click(radios[radios.length - 1]) // the newest batch, batch-2

    expect(await screen.findByText(/diubah, normal Rp 67\.000/)).toBeInTheDocument()
    // Same "Rp X / unit" compound-text pattern the Task 4 fix round settled
    // on for PriceEdit's closed-state button (see the line-rendering test
    // above): the button's price and unit share a single text node, so a
    // selector-scoped exact-string match ('Rp 63.000', { selector: 'button
    // *' }) can never find it - PriceEdit is unchanged by this task and its
    // established assertion pattern applies here too.
    expect(screen.getByText(/Rp 63\.000 \/ 50 kg/)).toBeInTheDocument()
  })

  it('warns and offers a one-tap split once a line\'s qty exceeds its current batch\'s own sisa', async () => {
    await seedBatch({ batchId: 'batch-1', itemId: 'semen', tanggalBeli: '2026-09-02', sisa: 3000 })
    await seedBatch({ batchId: 'batch-2', itemId: 'semen', tanggalBeli: '2026-09-15', sisa: 40000, hargaJual: 67000 })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' })) // picks batch-1 by construction of the harness (fixed batchId)

    const qtyInput = screen.getByLabelText(/^Jumlah Semen Tiga Roda · 50 kg/)
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    expect(await screen.findByText(/Ambil 2 50 kg dari batch berikutnya\?/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bagi otomatis' }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ubah batch/ })).toHaveLength(2))
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-1)')).toHaveValue(3)
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-2)')).toHaveValue(2)
  })

  it('single-batch over-sell: offers no split (there is nowhere else to draw from), keeps the full qty, and shows only the plain stock warning', async () => {
    await db.stokProj.put({ itemId: 'semen', quantity: 3000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' })
    await seedBatch({ batchId: 'batch-1', itemId: 'semen', sisa: 3000 })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await screen.findByRole('button', { name: /Ubah batch/ })

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-1)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    expect(await screen.findByText(/Stok Semen Tiga Roda · 50 kg tinggal 3 50 kg\. Lanjutkan\?/)).toBeInTheDocument()
    expect(screen.queryByText(/dari batch berikutnya/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bagi otomatis' })).toBeNull()
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-1)')).toHaveValue(5)
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeEnabled()
  })

  it('a legacy-only item sold past its legacy stock offers no split, only the plain stock warning', async () => {
    await db.stokProj.put({ itemId: 'semen', quantity: 2000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add legacy semen' }))
    await screen.findByRole('button', { name: /Ubah batch/ })

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (Stok lama)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    expect(await screen.findByText(/Stok Semen Tiga Roda · 50 kg tinggal 2 50 kg\. Lanjutkan\?/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bagi otomatis' })).toBeNull()
    expect(screen.queryByText(/dari batch berikutnya/)).toBeNull()
  })

  it('legacy pool plus one batch: the split moves only what the batch has, keeps the rest on Stok lama, and conserves the total qty', async () => {
    // Legacy pool 2 (stok 3 - batch sisa 1), batch-a sisa 1, the line (on
    // the legacy pool) has qty 5: the batch can cover only 1 of the 3
    // units the legacy pool is short.
    await db.stokProj.put({ itemId: 'semen', quantity: 3000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' })
    await seedBatch({ batchId: 'batch-a', itemId: 'semen', sisa: 1000, hargaJual: 67000 })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add legacy semen' }))
    await screen.findByRole('button', { name: /Ubah batch/ })

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (Stok lama)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    expect(await screen.findByText(/Ambil 1 50 kg dari batch berikutnya\?/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bagi otomatis' }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ubah batch/ })).toHaveLength(2))
    const legacyQty = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (Stok lama)')
    const batchQty = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-a)')
    expect(legacyQty).toHaveValue(4)
    expect(batchQty).toHaveValue(1)
    // Nothing else left to draw from: the offer is gone, the over-sell
    // stays warned (never blocked).
    expect(screen.queryByRole('button', { name: 'Bagi otomatis' })).toBeNull()
    expect(screen.getByText(/Stok Semen Tiga Roda · 50 kg tinggal 3 50 kg\. Lanjutkan\?/)).toBeInTheDocument()
  })

  it('offers no split into a batch whose own separate line would re-price the moved units', async () => {
    await seedBatch({ batchId: 'batch-1', itemId: 'semen', tanggalBeli: '2026-09-02', sisa: 3000 })
    await seedBatch({ batchId: 'batch-2', itemId: 'semen', tanggalBeli: '2026-09-15', sisa: 40000, hargaJual: 67000 })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Add semen batch-2' })) // its own line, at 67.000
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ubah batch/ })).toHaveLength(2))

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-1)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')
    // Unedited batch-1 price: moved units would re-price to batch-2's own
    // 67.000, exactly what batch-2's line already carries - a safe merge.
    expect(await screen.findByText(/Ambil 2 50 kg dari batch berikutnya\?/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ubah harga .*\(batch batch-1\)/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch batch-1)')
    await user.clear(priceInput)
    await user.type(priceInput, '60000')
    await user.tab()

    // Now the moved units would carry 60.000 into a 67.000 line: no offer.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bagi otomatis' })).toBeNull())
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-1)')).toHaveValue(5)
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-2)')).toHaveValue(1)
  })

  it('a split carries a manually-negotiated price onto every resulting line, and saving records one RecordSaleLine per batch', async () => {
    await seedBatch({ batchId: 'batch-1', itemId: 'semen', tanggalBeli: '2026-09-02', sisa: 3000 })
    await seedBatch({ batchId: 'batch-2', itemId: 'semen', tanggalBeli: '2026-09-15', sisa: 40000, hargaJual: 67000 })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: /Ubah harga/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch batch-1)')
    await user.clear(priceInput)
    await user.type(priceInput, '60000')
    await user.tab()

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch batch-1)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')
    await user.click(await screen.findByRole('button', { name: 'Bagi otomatis' }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ubah batch/ })).toHaveLength(2))
    expect(screen.getByRole('button', { name: /Ubah harga .*\(batch batch-1\)/ })).toHaveTextContent(/Rp 60\.000 \/ 50 kg/)
    expect(screen.getByRole('button', { name: /Ubah harga .*\(batch batch-2\)/ })).toHaveTextContent(/Rp 60\.000 \/ 50 kg/)

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    expect(await screen.findByText('Transaksi tersimpan')).toBeInTheDocument()
    expect(recordSale).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          { itemId: 'semen', nama: 'Semen Tiga Roda · 50 kg', unit: '50 kg', qty: 3000, hargaSatuan: 60000, subtotal: 180000, batchId: 'batch-1', hargaNormal: 65000 },
          { itemId: 'semen', nama: 'Semen Tiga Roda · 50 kg', unit: '50 kg', qty: 2000, hargaSatuan: 60000, subtotal: 120000, batchId: 'batch-2', hargaNormal: 67000 },
        ],
      }),
      expect.anything(),
    )
  })
})
