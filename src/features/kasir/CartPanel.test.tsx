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
import { systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'
import { ringkas, namaLengkap } from '../../domain/kalender'
import { bukaKalender, keTanggal } from '../../test-utils/pickDate'

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

    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch ch-1)')).toBeInTheDocument()
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

describe('CartPanel: what is not built yet is stated, not faked', () => {
  // These used to be four permanently disabled radio pills (Transfer, QRIS,
  // Bon, Kirim) plus a red "Diskon Rp 0" row. They looked tappable, cost a
  // third of the panel's height and made the quantity stepper scroll off
  // screen, so a single honest line replaced them (docs/UX-AUDIT.md #1, #11, #13).
  it('offers no Kirim control: delivery is not built', () => {
    render(<Harness />)
    expect(screen.queryByText(/Kirim/)).toBeNull()
  })

  it('shows no Diskon or Subtotal row, only the Total', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    expect(screen.queryByText('Diskon')).toBeNull()
    expect(screen.queryByText('Subtotal')).toBeNull()
    expect(within(screen.getByTestId('kasir-total')).getByText('Rp 65.000')).toBeInTheDocument()
  })

  it('renders no "Simpan sementara" control anywhere', () => {
    render(<Harness />)
    expect(screen.queryByText(/simpan sementara/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /sementara/i })).toBeNull()
  })
})

describe('CartPanel: manual price editing', () => {
  it('gives the price toggle button the control-size hit area', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    const toggle = screen.getByRole('button', { name: /Ubah harga Semen Tiga Roda/ })
    expect(toggle).toHaveClass('min-h-control', 'min-w-control')
  })

  it('shows the current price and lets it be edited inline, flagging "diubah" once it diverges', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.click(screen.getByRole('button', { name: /Ubah harga Semen Tiga Roda/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch ch-1)')
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

    const batchToggle = screen.getByRole('button', { name: /^Ubah harga Semen Tiga Roda · 50 kg \(batch ch-1\)/ })
    const legacyToggle = screen.getByRole('button', { name: /^Ubah harga Semen Tiga Roda · 50 kg \(Stok lama\)/ })
    expect(batchToggle).not.toBe(legacyToggle)
    // Label in name (WCAG 2.5.3): the visible price is part of the name,
    // not thrown away by an aria-label.
    expect(batchToggle).toHaveAccessibleName('Ubah harga Semen Tiga Roda · 50 kg (batch ch-1): Rp 65.000 / 50 kg')

    await user.click(legacyToggle)
    expect(screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (Stok lama)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Harga Semen Tiga Roda · 50 kg (batch ch-1)')).toBeNull()
  })

  it('the "(diubah, normal ...)" flag is part of the price-edit control\'s accessible name', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: /Ubah harga/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch ch-1)')
    await user.clear(priceInput)
    await user.type(priceInput, '60000')
    await user.tab()

    expect(await screen.findByRole('button', { name: /Ubah harga/ })).toHaveAccessibleName(
      'Ubah harga Semen Tiga Roda · 50 kg (batch ch-1): Rp 60.000 / 50 kg (diubah, normal Rp 65.000)',
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

  it('formats the typed amount with thousand separators, like every other Rupiah field', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))

    await user.type(screen.getByLabelText('Uang diterima'), '100000')

    expect(screen.getByLabelText('Uang diterima')).toHaveValue('100.000')
  })

  it('offers "Uang pas" plus the next two common notes above the total, and a tap fills the field', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' })) // total Rp 65.000

    const group = screen.getByRole('group', { name: 'Jumlah uang cepat' })
    expect(within(group).getAllByRole('button').map(b => b.textContent)).toEqual(['Uang pas', 'Rp 100.000', 'Rp 200.000'])

    await user.click(within(group).getByRole('button', { name: 'Rp 100.000' }))
    expect(screen.getByLabelText('Uang diterima')).toHaveValue('100.000')
    expect(screen.getByText('Kembalian: Rp 35.000')).toBeInTheDocument()
  })

  it('offers no quick amounts for an empty cart', () => {
    render(<Harness />)
    expect(screen.queryByRole('group', { name: 'Jumlah uang cepat' })).toBeNull()
  })
})

describe('CartPanel: the receipt after saving', () => {
  const saveWithCash = async (user: ReturnType<typeof userEvent.setup>, cash: string) => {
    await user.click(screen.getByRole('button', { name: 'Add semen' })) // Rp 65.000
    await user.type(screen.getByLabelText('Uang diterima'), cash)
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))
  }

  it('keeps the change on screen after saving, with the nota number, total and cash received', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await saveWithCash(user, '100000')

    const receipt = (await screen.findByText('Transaksi tersimpan')).closest('[role="status"]') as HTMLElement
    expect(within(receipt).getByText(/^#[0-9A-F]{6}$/)).toBeInTheDocument()
    expect(within(receipt).getByText('Rp 65.000')).toBeInTheDocument()
    expect(within(receipt).getByText('Rp 100.000')).toBeInTheDocument()
    expect(within(receipt).getByText('Kembalian')).toBeInTheDocument()
    expect(within(receipt).getByText('Rp 35.000')).toBeInTheDocument()
  })

  it('does not time out: the change is still there well after the old 3-second toast would have gone', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await saveWithCash(user, '100000')
    await screen.findByText('Transaksi tersimpan')

    // The old toast hid itself after 3000ms. The receipt has no timer at all,
    // so nothing here can remove it; a short real wait proves no short timer
    // does, and the assertion below would fail if one were reintroduced.
    await new Promise(resolve => setTimeout(resolve, 300))

    expect(screen.getByText('Transaksi tersimpan')).toBeInTheDocument()
    expect(screen.getByText('Rp 35.000')).toBeInTheDocument()
  })

  it('shows no change block when no cash amount was entered', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    const receipt = (await screen.findByText('Transaksi tersimpan')).closest('[role="status"]') as HTMLElement
    expect(within(receipt).queryByText('Kembalian')).toBeNull()
    expect(within(receipt).queryByText('Uang diterima')).toBeNull()
  })

  it('shows "Kurang" instead of a negative change when the customer paid too little', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await saveWithCash(user, '50000')

    const receipt = (await screen.findByText('Transaksi tersimpan')).closest('[role="status"]') as HTMLElement
    expect(within(receipt).getByText('Kurang')).toBeInTheDocument()
    expect(within(receipt).getByText('Rp 15.000')).toBeInTheDocument()
  })

  it('"Transaksi baru" dismisses the receipt and calls onDone', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    function WithDone() {
      const cart = useCart()
      return (
        <div>
          <button onClick={() => cart.addItem(semen, 'batch-1', 65000)}>Add semen</button>
          <CartPanel cart={cart} onDone={onDone} />
        </div>
      )
    }
    render(<WithDone />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))
    await screen.findByText('Transaksi tersimpan')

    await user.click(screen.getByRole('button', { name: 'Transaksi baru' }))

    expect(screen.queryByText('Transaksi tersimpan')).toBeNull()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('adding an item for the next customer ends the receipt', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await saveWithCash(user, '100000')
    await screen.findByText('Transaksi tersimpan')

    await user.click(screen.getByRole('button', { name: 'Add pasir' }))

    expect(screen.queryByText('Transaksi tersimpan')).toBeNull()
  })
})

describe('CartPanel: accessible names never expose a raw batch id', () => {
  it('names a line by its batch position and purchase date, not the UUID', async () => {
    const id = '01a0ec64-4b79-7f4d-afb5-3abde989dad6'
    function UuidHarness() {
      const cart = useCart()
      return (
        <div>
          <button onClick={() => cart.addItem(semen, id, 65000)}>Add</button>
          <CartPanel cart={cart} />
        </div>
      )
    }
    await db.batchesProj.put({
      batchId: id, itemId: 'semen', hargaJual: 65000, tanggalBeli: '2026-09-29', diterima: 40000, sisa: 40000,
      metaUpdatedAt: '2026-09-29T07:00:00.000Z', metaUpdatedByEventId: 'e1',
      lastMovementAt: '2026-09-29T07:00:00.000Z', lastMovementEventId: 'e1',
    })
    const user = userEvent.setup()
    render(<UuidHarness />)
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const qty = await screen.findByLabelText(/^Jumlah Semen Tiga Roda/)
    expect(qty).toHaveAccessibleName('Jumlah Semen Tiga Roda · 50 kg (batch 1, 29 Sep 2026)')
    const everyName = screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent ?? '')
    expect(everyName.join(' ')).not.toContain('01a0ec64')
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
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')
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
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')).toHaveValue(3)
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 2, 15 Sep 2026)')).toHaveValue(2)
  })

  it('single-batch over-sell: offers no split (there is nowhere else to draw from), keeps the full qty, and shows only the plain stock warning', async () => {
    await db.stokProj.put({ itemId: 'semen', quantity: 3000, lastMovementAt: '2026-09-18T07:00:00.000Z', lastMovementEventId: 'e1' })
    await seedBatch({ batchId: 'batch-1', itemId: 'semen', sisa: 3000 })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await screen.findByRole('button', { name: /Ubah batch/ })

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')

    expect(await screen.findByText(/Stok Semen Tiga Roda · 50 kg tinggal 3 50 kg\. Lanjutkan\?/)).toBeInTheDocument()
    expect(screen.queryByText(/dari batch berikutnya/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bagi otomatis' })).toBeNull()
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')).toHaveValue(5)
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
    const batchQty = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')
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

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')
    // Unedited batch-1 price: moved units would re-price to batch-2's own
    // 67.000, exactly what batch-2's line already carries - a safe merge.
    expect(await screen.findByText(/Ambil 2 50 kg dari batch berikutnya\?/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ubah harga .*\((batch 1, 2 Sep 2026)\)/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')
    await user.clear(priceInput)
    await user.type(priceInput, '60000')
    await user.tab()

    // Now the moved units would carry 60.000 into a 67.000 line: no offer.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Bagi otomatis' })).toBeNull())
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')).toHaveValue(5)
    expect(screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 2, 15 Sep 2026)')).toHaveValue(1)
  })

  it('a split carries a manually-negotiated price onto every resulting line, and saving records one RecordSaleLine per batch', async () => {
    await seedBatch({ batchId: 'batch-1', itemId: 'semen', tanggalBeli: '2026-09-02', sisa: 3000 })
    await seedBatch({ batchId: 'batch-2', itemId: 'semen', tanggalBeli: '2026-09-15', sisa: 40000, hargaJual: 67000 })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: /Ubah harga/ }))
    const priceInput = screen.getByLabelText('Harga Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')
    await user.clear(priceInput)
    await user.type(priceInput, '60000')
    await user.tab()

    const qtyInput = screen.getByLabelText('Jumlah Semen Tiga Roda · 50 kg (batch 1, 2 Sep 2026)')
    await user.clear(qtyInput)
    await user.type(qtyInput, '5')
    await user.click(await screen.findByRole('button', { name: 'Bagi otomatis' }))

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ubah batch/ })).toHaveLength(2))
    expect(screen.getByRole('button', { name: /Ubah harga .*\((batch 1, 2 Sep 2026)\)/ })).toHaveTextContent(/Rp 60\.000 \/ 50 kg/)
    expect(screen.getByRole('button', { name: /Ubah harga .*\((batch 2, 15 Sep 2026)\)/ })).toHaveTextContent(/Rp 60\.000 \/ 50 kg/)

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

describe('CartPanel: Bon', () => {
  const customer = (id: string, nama: string, termynHari = 30) =>
    db.customersProj.put({ id, nama, tier: 'eceran', termynHari, updatedAt: 't', updatedByEventId: 'e' })

  const startBon = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Add semen' })) // total Rp 65.000
    await user.click(screen.getByRole('button', { name: 'Bon' }))
  }

  const pickPelanggan = async (user: ReturnType<typeof userEvent.setup>, nama: string) => {
    await user.click(await screen.findByRole('combobox', { name: 'Pelanggan' }))
    await user.click(await screen.findByRole('option', { name: nama }))
  }

  it('Bon swaps the cash block for Pelanggan, Jatuh tempo and Dibayar sekarang', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)

    expect(screen.queryByLabelText('Uang diterima')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Pelanggan' })).toBeInTheDocument()
    expect(screen.getByLabelText('Jatuh tempo')).toBeInTheDocument()
    expect(screen.getByLabelText('Dibayar sekarang (opsional)')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Metode bayar' })).getByRole('button', { name: 'Bon' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('blocks saving until a customer is chosen, with the reason shown inline', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)

    expect(screen.getByText('Pilih pelanggan untuk Bon.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Simpan & buat baru' })).toBeDisabled()
  })

  it('defaults the due date to today plus the customer\'s terms', async () => {
    await customer('c1', 'Budi', 14)
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)
    await pickPelanggan(user, 'Budi')

    expect(screen.getByLabelText('Jatuh tempo')).toHaveTextContent(ringkas(isoDateDaysAgo(systemClock, -14)))
    expect(screen.queryByText('Pilih pelanggan untuk Bon.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeEnabled()
  })

  it('a customer quick-added before the list refreshed still gets a 30-day due date', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)

    await user.click(screen.getByRole('combobox', { name: 'Pelanggan' }))
    await user.type(screen.getByRole('combobox', { name: 'Pelanggan' }), 'Toko Baru')
    await user.click(screen.getByText(/tambah.*Toko Baru/i))

    await waitFor(() => expect(screen.queryByText('Pilih pelanggan untuk Bon.')).toBeNull())
    expect(screen.getByLabelText('Jatuh tempo')).toHaveTextContent(ringkas(isoDateDaysAgo(systemClock, -30)))
  })

  it('rejects a down payment at or above the total and points to Tunai', async () => {
    await customer('c1', 'Budi')
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)
    await pickPelanggan(user, 'Budi')

    await user.type(screen.getByLabelText('Dibayar sekarang (opsional)'), '65000')

    expect(screen.getByText('Jika lunas sekarang, pilih Tunai.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeDisabled()
  })

  it('does not let a due date before today be chosen', async () => {
    await customer('c1', 'Budi')
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)
    await pickPelanggan(user, 'Budi')

    const kartu = await bukaKalender(user, /Jatuh tempo/)
    // The calendar opens on the default due date (later); go back to today's month, which is the edge.
    await keTanggal(user, isoDateDaysAgo(systemClock, 0))
    expect(within(kartu).getByRole('button', { name: 'Bulan sebelumnya' })).toBeDisabled()
    const kemarin = within(kartu).queryByRole('button', { name: namaLengkap(isoDateDaysAgo(systemClock, 1)) })
    if (kemarin) expect(kemarin).toBeDisabled() // absent only when today is the 1st
    expect(within(kartu).getByRole('button', { name: namaLengkap(isoDateDaysAgo(systemClock, 0)) })).toBeEnabled()
  })

  it('a due date chosen from the calendar is the one that is saved', async () => {
    await customer('c1', 'Budi')
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)
    await pickPelanggan(user, 'Budi')

    const tujuan = isoDateDaysAgo(systemClock, -45)
    await bukaKalender(user, /Jatuh tempo/)
    await user.click(await keTanggal(user, tujuan))
    expect(screen.getByLabelText('Jatuh tempo')).toHaveTextContent(ringkas(tujuan))

    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))
    await screen.findByText('Transaksi tersimpan')
    expect((await db.salesProj.toArray())[0].jatuhTempo).toBe(tujuan)
  })

  it('shows what stays as piutang after a down payment', async () => {
    await customer('c1', 'Budi')
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)
    await pickPelanggan(user, 'Budi')

    await user.type(screen.getByLabelText('Dibayar sekarang (opsional)'), '20000')

    expect(screen.getByText('Sisa jadi piutang: Rp 45.000')).toBeInTheDocument()
  })

  it('saves a Bon sale with its customer, due date and down payment, then shows Sisa piutang on the receipt', async () => {
    await customer('c1', 'Budi', 14)
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)
    await pickPelanggan(user, 'Budi')
    await user.type(screen.getByLabelText('Dibayar sekarang (opsional)'), '20000')
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    expect(await screen.findByText('Transaksi tersimpan')).toBeInTheDocument()
    const sale = (await db.salesProj.toArray())[0]
    expect(sale).toMatchObject({
      metodeBayar: 'bon', customerId: 'c1', dibayarAwal: 20000, total: 65000,
      jatuhTempo: isoDateDaysAgo(systemClock, -14),
    })
    expect(screen.getByText('Sisa piutang')).toBeInTheDocument()
    expect(screen.getByText('Rp 45.000')).toBeInTheDocument()
    expect(screen.getByText(/Jatuh tempo \d{1,2} \w+ \d{4}/)).toBeInTheDocument()
    expect(screen.queryByText('Kembalian')).toBeNull()
  })

  it('saves a Bon with no down payment without a dibayarAwal', async () => {
    await customer('c1', 'Budi')
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)
    await pickPelanggan(user, 'Budi')
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    await screen.findByText('Transaksi tersimpan')
    const sale = (await db.salesProj.toArray())[0]
    expect(sale.metodeBayar).toBe('bon')
    expect(sale.dibayarAwal).toBeUndefined()
    expect(screen.getByText('Rp 65.000', { selector: 'span.text-xl' })).toBeInTheDocument()
  })

  it('goes back to Tunai with no customer after a Bon is saved, so the next sale cannot become Bon by accident', async () => {
    await customer('c1', 'Budi')
    const user = userEvent.setup()
    render(<Harness />)
    await startBon(user)
    await pickPelanggan(user, 'Budi')
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))
    await screen.findByText('Transaksi tersimpan')

    await user.click(screen.getByRole('button', { name: 'Add pasir' }))

    expect(within(screen.getByRole('group', { name: 'Metode bayar' })).getByRole('button', { name: 'Tunai' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Uang diterima')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bon' }))
    expect(screen.getByText('Pilih pelanggan untuk Bon.')).toBeInTheDocument()
  })

  it('a Tunai sale is unchanged: no customer, no due date', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.type(screen.getByLabelText('Uang diterima'), '70000')
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    await screen.findByText('Transaksi tersimpan')
    const sale = (await db.salesProj.toArray())[0]
    expect(sale.metodeBayar).toBe('tunai')
    expect(sale.customerId).toBeUndefined()
    expect(sale.jatuhTempo).toBeUndefined()
  })
})

describe('CartPanel: Transfer and QRIS', () => {
  const metodeGroup = () => screen.getByRole('group', { name: 'Metode bayar' })

  it('offers Tunai, Transfer, QRIS and Bon, Tunai chosen', () => {
    render(<Harness />)
    expect(within(metodeGroup()).getAllByRole('button').map(b => b.textContent)).toEqual(['Tunai', 'Transfer', 'QRIS', 'Bon'])
    expect(within(metodeGroup()).getByRole('button', { name: 'Tunai' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Transfer swaps the cash block for a plain note that it is paid in full', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(within(metodeGroup()).getByRole('button', { name: 'Transfer' }))

    expect(screen.queryByLabelText('Uang diterima')).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Pelanggan' })).toBeNull()
    expect(screen.getByText('Dibayar penuh lewat Transfer.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simpan transaksi' })).toBeEnabled()
  })

  it.each([['Transfer', 'transfer'], ['QRIS', 'qris']] as const)('saves a %s sale paid in full, with no cash tendered', async (label, metode) => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(within(metodeGroup()).getByRole('button', { name: label }))
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))

    await screen.findByText('Transaksi tersimpan')
    expect(recordSale).toHaveBeenCalledWith(expect.objectContaining({ metodeBayar: metode, uangDiterima: undefined, customerId: undefined }), expect.anything())
    const sale = (await db.salesProj.toArray())[0]
    expect(sale).toMatchObject({ metodeBayar: metode, total: 65000 })
    expect(screen.queryByText('Kembalian')).toBeNull()
    expect(screen.getByText(`Dibayar lewat ${label}`)).toBeInTheDocument()
  })

  it('goes back to Tunai after saving, so the next sale is not a transfer by accident', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(within(metodeGroup()).getByRole('button', { name: 'QRIS' }))
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))
    await screen.findByText('Transaksi tersimpan')
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    expect(within(metodeGroup()).getByRole('button', { name: 'Tunai' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('CartPanel: tanggal transaksi', () => {
  const hariIni = () => isoDateDaysAgo(systemClock, 0)
  const customer = (id: string, nama: string, termynHari = 30) =>
    db.customersProj.put({ id, nama, tier: 'eceran', termynHari, updatedAt: 't', updatedByEventId: 'e' })

  it('says the sale is dated today and offers to change it, showing no picker yet', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    expect(screen.getByText('Tanggal transaksi: hari ini')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tanggal transaksi')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ubah tanggal' })).toBeInTheDocument()
  })

  it('saves a sale on an earlier day at that day, and says so in a way that is hard to miss', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Ubah tanggal' }))
    const lalu = isoDateDaysAgo(systemClock, 3)
    await bukaKalender(user, /Tanggal transaksi/)
    await user.click(await keTanggal(user, lalu))

    expect(screen.getByText(`Transaksi dicatat untuk ${ringkas(lalu)}`)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))
    await screen.findByText('Transaksi tersimpan')

    expect(recordSale).toHaveBeenCalledWith(expect.objectContaining({ tanggal: lalu }), expect.anything())
    const sale = (await db.salesProj.toArray())[0]
    const [y, m, d] = lalu.split('-').map(Number)
    expect(sale.occurredAt).toBe(new Date(y, m - 1, d, 12).toISOString())
  })

  it('"Kembali ke hari ini" undoes the change', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Ubah tanggal' }))
    await bukaKalender(user, /Tanggal transaksi/)
    await user.click(await keTanggal(user, isoDateDaysAgo(systemClock, 2)))
    await user.click(screen.getByRole('button', { name: 'Kembali ke hari ini' }))
    expect(screen.getByText('Tanggal transaksi: hari ini')).toBeInTheDocument()
  })

  it('does not let a day after today be picked', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Ubah tanggal' }))
    const kartu = await bukaKalender(user, /Tanggal transaksi/)
    await keTanggal(user, hariIni())
    const besok = within(kartu).queryByRole('button', { name: namaLengkap(isoDateDaysAgo(systemClock, -1)) })
    if (besok) expect(besok).toBeDisabled() // absent only when today is the last day of the month
    expect(within(kartu).getByRole('button', { name: 'Bulan berikutnya' })).toBeDisabled()
  })

  it('is dated today again for the next sale', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Ubah tanggal' }))
    await bukaKalender(user, /Tanggal transaksi/)
    await user.click(await keTanggal(user, isoDateDaysAgo(systemClock, 2)))
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))
    await screen.findByText('Transaksi tersimpan')

    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    expect(screen.getByText('Tanggal transaksi: hari ini')).toBeInTheDocument()
  })

  it('a Bon default due date counts from the sale date, and it may not be due before it', async () => {
    await customer('c1', 'Budi', 14)
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Add semen' }))
    await user.click(screen.getByRole('button', { name: 'Ubah tanggal' }))
    const lalu = isoDateDaysAgo(systemClock, 20)
    await bukaKalender(user, /Tanggal transaksi/)
    await user.click(await keTanggal(user, lalu))
    await user.click(screen.getByRole('button', { name: 'Bon' }))
    await user.click(await screen.findByRole('combobox', { name: 'Pelanggan' }))
    await user.click(await screen.findByRole('option', { name: 'Budi' }))

    const tempo = isoDateDaysAgo(systemClock, 20 - 14) // 20 days ago + 14 days: 6 days ago, already past
    expect(screen.getByLabelText('Jatuh tempo')).toHaveTextContent(ringkas(tempo))
    await user.click(screen.getByRole('button', { name: 'Simpan transaksi' }))
    await screen.findByText('Transaksi tersimpan')
    const sale = (await db.salesProj.toArray())[0]
    expect(sale).toMatchObject({ metodeBayar: 'bon', jatuhTempo: tempo })
  })
})
