import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
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
})
