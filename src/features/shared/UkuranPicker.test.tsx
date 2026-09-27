import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { UkuranPicker } from './UkuranPicker'

beforeEach(async () => {
  await db.delete()
  await db.open()
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

  it('creates a new ukuran under the given barang via the + button, and selects it', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<UkuranPicker barangId="b1" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /tambah ukuran baru/i }))
    // Scoped to the dialog: the picker's own Combobox is also labeled
    // "Ukuran" and stays mounted underneath the open UkuranSheet, so an
    // unscoped getByLabelText(/^ukuran$/i) matches both.
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/^ukuran$/i), '25 kg')
    await user.type(dialog.getByLabelText(/harga eceran/i), '35000')
    await user.type(dialog.getByLabelText(/stok minimum/i), '5')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    // recordUkuran's IndexedDB write resolves after user.click()'s own
    // promise does, so the assertion needs to wait for it rather than check
    // synchronously - same convention as Supplier.test.tsx's own create flow.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String)))
    const items = await db.itemsProj.toArray()
    expect(items.map(i => i.baseUnit)).toContain('25 kg')
  })
})
