import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { recordSupplier } from '../../data/commands'
import { ToastProvider } from '../../ui/Toast'
import { SupplierPicker } from './SupplierPicker'

// recordSupplier is wrapped as a spy over its real implementation, so every
// existing test still writes through to fake-indexeddb as before; only the
// "recordSupplier fails" test overrides it for a single call. Same pattern
// as CartPanel.test.tsx's recordSale mock.
vi.mock('../../data/commands', async () => {
  const actual = await vi.importActual<typeof import('../../data/commands')>('../../data/commands')
  return { ...actual, recordSupplier: vi.fn(actual.recordSupplier) }
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.mocked(recordSupplier).mockClear()
})

describe('SupplierPicker', () => {
  it('lists existing suppliers as options', async () => {
    await db.suppliersProj.put({ id: 's1', nama: 'CV Maju', perluDilengkapi: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    const user = userEvent.setup()
    render(<ToastProvider><SupplierPicker value={null} onChange={vi.fn()} /></ToastProvider>)

    await user.click(await screen.findByRole('combobox'))

    expect(screen.getByRole('option', { name: 'CV Maju' })).toBeInTheDocument()
  })

  it('shows the phone number of a supplier as a hint', async () => {
    await db.suppliersProj.put({ id: 's1', nama: 'CV Maju', telepon: '0812-555-0101', perluDilengkapi: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    const user = userEvent.setup()
    render(<ToastProvider><SupplierPicker value={null} onChange={vi.fn()} /></ToastProvider>)

    await user.click(await screen.findByRole('combobox'))

    expect(screen.getByRole('option', { name: 'CV Maju' })).toHaveAccessibleDescription('0812-555-0101')
  })

  it('quick-adds a supplier via the in-list create row, selects it, sets perluDilengkapi, and toasts', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ToastProvider><SupplierPicker value={null} onChange={onChange} /></ToastProvider>)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'UD Baru')
    await user.click(screen.getByText(/tambah.*UD Baru/i))

    // recordSupplier's IndexedDB write resolves after user.click()'s own
    // promise does - same class of timing gap as BarangPicker/UkuranPicker's
    // own create-flow tests (Task 4's ledger), same fix: waitFor.
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String)))
    const suppliers = await db.suppliersProj.toArray()
    expect(suppliers.find(s => s.nama === 'UD Baru')).toMatchObject({ perluDilengkapi: true })
    expect(await screen.findByText(/supplier ditambahkan/i)).toBeInTheDocument()
  })

  it('surfaces a visible error, and does not select or toast, when the quick-add write fails', async () => {
    vi.mocked(recordSupplier).mockRejectedValueOnce(new Error('write failed'))
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ToastProvider><SupplierPicker value={null} onChange={onChange} /></ToastProvider>)

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByRole('combobox'), 'UD Baru')
    await user.click(screen.getByText(/tambah.*UD Baru/i))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal ditambahkan/i)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByText(/supplier ditambahkan/i)).toBeNull()
  })

  it('has a "+" that opens the full supplier form, saves it complete, and selects it', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ToastProvider><SupplierPicker value={null} onChange={onChange} /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: 'Tambah supplier baru' }))
    const sheet = await screen.findByRole('dialog', { name: 'Supplier baru' })
    await user.type(within(sheet).getByLabelText('Nama'), 'UD Lengkap')
    await user.type(within(sheet).getByLabelText('Telepon'), '0812-1')
    await user.click(within(sheet).getByRole('button', { name: /^Simpan/ }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String)))
    const saved = (await db.suppliersProj.toArray()).find(s => s.nama === 'UD Lengkap')
    expect(saved).toMatchObject({ telepon: '0812-1', perluDilengkapi: false })
  })

  it('the "+" sits beside the field at the same control height and field shape', () => {
    render(<ToastProvider><SupplierPicker value={null} onChange={vi.fn()} /></ToastProvider>)
    expect(screen.getByRole('button', { name: 'Tambah supplier baru' })).toHaveClass('h-control', 'w-control', 'rounded-field')
  })

  it('a failed save keeps the sheet open and says so inside it', async () => {
    vi.mocked(recordSupplier).mockRejectedValueOnce(new Error('quota'))
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ToastProvider><SupplierPicker value={null} onChange={onChange} /></ToastProvider>)
    await user.click(screen.getByRole('button', { name: 'Tambah supplier baru' }))
    const sheet = await screen.findByRole('dialog', { name: 'Supplier baru' })
    await user.type(within(sheet).getByLabelText('Nama'), 'UD Gagal')
    await user.click(within(sheet).getByRole('button', { name: /^Simpan/ }))
    expect(await within(sheet).findByText('Supplier gagal disimpan. Coba lagi.')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
