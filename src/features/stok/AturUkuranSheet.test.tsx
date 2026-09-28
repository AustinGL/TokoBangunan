import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { updateUkuran } from '../../data/commands'
import { AturUkuranSheet } from './AturUkuranSheet'

vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, updateUkuran: vi.fn(actual.updateUkuran) }
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.mocked(updateUkuran).mockClear()
})

const seedUkuran = () =>
  db.itemsProj.put({
    id: 'u1', nama: 'Semen Tiga Roda', baseUnit: '50 kg', units: [{ unit: '50 kg', factor: 1 }],
    hargaEceran: 65000, stokMinimum: 10, diarsipkan: false,
    updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1',
  })

const item = { id: 'u1', ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10 }

describe('AturUkuranSheet', () => {
  it('prefills the current harga jual and stok minimum', async () => {
    render(<AturUkuranSheet open onClose={vi.fn()} item={item} />)

    expect(screen.getByLabelText(/harga jual/i)).toHaveValue('65.000')
    expect(screen.getByLabelText(/stok minimum/i)).toHaveValue(10)
  })

  it('calls updateUkuran with only id/hargaEceran/stokMinimum on submit, then closes', async () => {
    await seedUkuran()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AturUkuranSheet open onClose={onClose} item={item} />)

    await user.clear(screen.getByLabelText(/harga jual/i))
    await user.type(screen.getByLabelText(/harga jual/i), '67000')
    await user.clear(screen.getByLabelText(/stok minimum/i))
    await user.type(screen.getByLabelText(/stok minimum/i), '15')
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(updateUkuran).toHaveBeenCalledWith(
      { id: 'u1', hargaEceran: 67000, stokMinimum: 15 },
      expect.objectContaining({ deviceId: expect.any(String) }),
    )
  })

  it('rejects a negative stok minimum without calling updateUkuran', async () => {
    const user = userEvent.setup()
    render(<AturUkuranSheet open onClose={vi.fn()} item={item} />)

    await user.clear(screen.getByLabelText(/stok minimum/i))
    await user.type(screen.getByLabelText(/stok minimum/i), '-1')
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByText(/stok minimum wajib diisi/i)).toBeInTheDocument()
    expect(updateUkuran).not.toHaveBeenCalled()
  })

  it('rejects an empty stok minimum without calling updateUkuran', async () => {
    const user = userEvent.setup()
    render(<AturUkuranSheet open onClose={vi.fn()} item={item} />)

    // Number('') is 0, so an emptied field must be rejected explicitly - it
    // must not silently validate as "0" and call updateUkuran with a
    // stokMinimum the owner never actually entered.
    await user.clear(screen.getByLabelText(/stok minimum/i))
    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByText(/stok minimum wajib diisi/i)).toBeInTheDocument()
    expect(updateUkuran).not.toHaveBeenCalled()
  })

  it('surfaces a visible error when the write fails, and does not close', async () => {
    await seedUkuran()
    vi.mocked(updateUkuran).mockRejectedValueOnce(new Error('boom'))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AturUkuranSheet open onClose={onClose} item={item} />)

    await user.click(screen.getByRole('button', { name: /^simpan$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
    expect(onClose).not.toHaveBeenCalled()
  })
})
