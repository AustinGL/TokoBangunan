import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordUkuran } from '../../data/commands'
import { UkuranPicker } from './UkuranPicker'

// recordUkuran is wrapped as a spy over its real implementation, so every
// existing test still writes through to fake-indexeddb as before; only the
// "write fails" test overrides it for a single call. Same pattern as
// CartPanel.test.tsx's recordSale mock.
vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, recordUkuran: vi.fn(actual.recordUkuran) }
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.mocked(recordUkuran).mockClear()
})

describe('UkuranPicker', () => {
  it('is disabled when barangId is null', () => {
    render(<UkuranPicker barangId={null} value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('lists only the given barang\'s own ukuran, excluding archived ones and other barang\'s', async () => {
    await db.barangProj.bulkPut([
      { id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
      { id: 'b2', nama: 'Pasir', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2' },
    ])
    await db.itemsProj.bulkPut([
      {
        id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }],
        hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e3',
      },
      {
        id: 'u2', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '40 kg', units: [{ unit: '40 kg', factor: 1 }],
        hargaEceran: 58000, stokMinimum: 10, diarsipkan: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e4',
      },
      {
        id: 'u3', barangId: 'b2', nama: 'Pasir', baseUnit: 'm3', units: [{ unit: 'm3', factor: 1 }],
        hargaEceran: 180000, stokMinimum: 5, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e5',
      },
    ])
    const user = userEvent.setup()
    render(<UkuranPicker barangId="b1" value={null} onChange={vi.fn()} />)

    await user.click(await screen.findByRole('combobox'))

    expect(screen.getByRole('option', { name: '50 kg' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '40 kg' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'm3' })).toBeNull()
  })

  it('shows the stock and retail price of each ukuran as a hint', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    await db.itemsProj.put({
      id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }],
      hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e3',
    })
    const user = userEvent.setup()
    render(<UkuranPicker barangId="b1" value={null} onChange={vi.fn()} />)

    await user.click(await screen.findByRole('combobox'))

    expect(screen.getByRole('option', { name: '50 kg' })).toHaveAccessibleDescription('Stok 0 · Rp 65.000')
  })

  it('creates a new ukuran under the given barang via the + button, and selects it', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<UkuranPicker barangId="b1" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /tambah ukuran baru/i }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/^ukuran$/i), '25 kg')
    await user.type(dialog.getByLabelText(/harga eceran/i), '35000')
    await user.type(dialog.getByLabelText(/stok minimum/i), '5')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    // The create path passes the just-typed price along explicitly (not
    // just the new id): useKatalog's own live query has not necessarily
    // re-fetched by the time this resolves, so a caller relying solely on
    // its own katalog data would find nothing there yet for the new id.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String), { hargaEceran: 35000 }))
    const items = await db.itemsProj.toArray()
    expect(items.map(i => i.baseUnit)).toContain('25 kg')
  })

  it('does not submit a surrounding form when the + quick-add sheet is saved', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    const onFormSubmit = vi.fn(e => e.preventDefault())
    const user = userEvent.setup()
    render(
      <form onSubmit={onFormSubmit}>
        <UkuranPicker barangId="b1" value={null} onChange={vi.fn()} />
      </form>,
    )

    await user.click(screen.getByRole('button', { name: /tambah ukuran baru/i }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/^ukuran$/i), '25 kg')
    await user.type(dialog.getByLabelText(/harga eceran/i), '35000')
    await user.type(dialog.getByLabelText(/stok minimum/i), '5')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onFormSubmit).not.toHaveBeenCalled()
  })

  it('offers "Pakai yang ada" / "Tetap buat baru" for a near-duplicate ukuran, instead of creating immediately', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    await db.itemsProj.put({
      id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }],
      hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2',
    })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<UkuranPicker barangId="b1" value={null} onChange={onChange} />)

    await user.click(await screen.findByRole('button', { name: /tambah ukuran baru/i }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/^ukuran$/i), '50kg') // normalizes the same as "50 kg"
    await user.type(dialog.getByLabelText(/harga eceran/i), '65000')
    await user.type(dialog.getByLabelText(/stok minimum/i), '10')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByText(/mirip dengan/i)).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    const itemsBeforeChoice = await db.itemsProj.toArray()
    expect(itemsBeforeChoice).toHaveLength(1) // no duplicate written yet

    await user.click(screen.getByRole('button', { name: /pakai yang ada/i }))

    expect(onChange).toHaveBeenCalledWith('u1')
    expect(await db.itemsProj.toArray()).toHaveLength(1) // still just the original
  })

  it('creates the typed ukuran anyway when "Tetap buat baru" is chosen after a near-duplicate warning', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    await db.itemsProj.put({
      id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }],
      hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2',
    })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<UkuranPicker barangId="b1" value={null} onChange={onChange} />)

    await user.click(await screen.findByRole('button', { name: /tambah ukuran baru/i }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/^ukuran$/i), '50kg')
    await user.type(dialog.getByLabelText(/harga eceran/i), '65000')
    await user.type(dialog.getByLabelText(/stok minimum/i), '10')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    await screen.findByText(/mirip dengan/i)
    await user.click(screen.getByRole('button', { name: /tetap buat baru/i }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String), { hargaEceran: 65000 }))
    expect(onChange).not.toHaveBeenCalledWith('u1')
    const items = await db.itemsProj.toArray()
    expect(items.map(i => i.baseUnit)).toContain('50kg')
    expect(items).toHaveLength(2)
  })

  it('surfaces a visible error inside the still-open dialog when a normal (non-duplicate) create fails, without closing it', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    vi.mocked(recordUkuran).mockRejectedValueOnce(new Error('write failed'))
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<UkuranPicker barangId="b1" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /tambah ukuran baru/i }))
    const dialog = within(screen.getByRole('dialog', { name: 'Ukuran baru' }))
    await user.type(dialog.getByLabelText(/^ukuran$/i), '25 kg')
    await user.type(dialog.getByLabelText(/harga eceran/i), '35000')
    await user.type(dialog.getByLabelText(/stok minimum/i), '5')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    // Failing to catch this inside UkuranPicker (letting it reach
    // UkuranSheet's own onSubmit try/catch instead) is what puts the error
    // inside the dialog that is still open - a sibling error paragraph
    // outside it would sit behind the open <dialog>'s own top layer,
    // invisible to the user.
    expect(await dialog.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
    expect(dialog.getByLabelText(/^ukuran$/i)).toHaveValue('25 kg') // the dialog stayed open with what was typed
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('UkuranPicker: near-duplicate confirm footer', () => {
  it('keeps both actions inside a sticky footer', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    await db.itemsProj.put({
      id: 'u1', barangId: 'b1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }],
      hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2',
    })
    const user = userEvent.setup()
    render(<UkuranPicker barangId="b1" value={null} onChange={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /tambah ukuran baru/i }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/^ukuran$/i), '50kg')
    await user.type(dialog.getByLabelText(/harga eceran/i), '65000')
    await user.type(dialog.getByLabelText(/stok minimum/i), '10')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    const pakai = await screen.findByRole('button', { name: /pakai yang ada/i })
    expect(pakai.parentElement).toHaveClass('sticky', 'bottom-0')
    expect(screen.getByRole('button', { name: /tetap buat baru/i }).parentElement).toBe(pakai.parentElement)
  })
})
