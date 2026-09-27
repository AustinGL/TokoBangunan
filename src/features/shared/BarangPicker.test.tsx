import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { BarangPicker } from './BarangPicker'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('BarangPicker', () => {
  it('lists non-archived barang as options, excluding archived and virtual ones', async () => {
    await db.barangProj.bulkPut([
      { id: 'b1', nama: 'Semen Tiga Roda', diarsipkan: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
      { id: 'b2', nama: 'Semen Lama', diarsipkan: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2' },
    ])
    const user = userEvent.setup()
    render(<BarangPicker value={null} onChange={vi.fn()} />)

    await user.click(await screen.findByRole('combobox'))

    expect(screen.getByRole('option', { name: 'Semen Tiga Roda' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Semen Lama' })).toBeNull()
  })

  it('creates a new barang via the + button, and selects it', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<BarangPicker value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /tambah barang baru/i }))
    // Scoped to the dialog: the picker's own Combobox is also labeled "Nama
    // barang" and stays mounted underneath the open BarangSheet, so an
    // unscoped getByLabelText matches both.
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/nama barang/i), 'Pasir Halus')
    await user.click(dialog.getByRole('button', { name: /^simpan$/i }))

    // recordBarang's IndexedDB write resolves after user.click()'s own
    // promise does, so the assertion needs to wait for it rather than check
    // synchronously - same convention as Supplier.test.tsx's own create flow.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String)))
    const newBarang = await db.barangProj.toArray()
    expect(newBarang.map(b => b.nama)).toContain('Pasir Halus')
  })
})
