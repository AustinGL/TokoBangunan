import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { Supplier } from './Supplier'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Supplier: loading, empty and list', () => {
  it('renders a distinct loading state', () => {
    render(<Supplier />)
    expect(screen.getByRole('status')).toHaveTextContent(/memuat/i)
  })

  it('renders an empty-state invitation with no suppliers', async () => {
    render(<Supplier />)
    expect(await screen.findByText(/belum ada supplier/i)).toBeInTheDocument()
  })

  it('lists suppliers and shows the perlu dilengkapi pill', async () => {
    await db.suppliersProj.bulkPut([
      { id: 's1', nama: 'CV Maju', perluDilengkapi: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
      { id: 's2', nama: 'UD Baru', perluDilengkapi: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2' },
    ])
    render(<Supplier />)

    await screen.findByText('CV Maju')
    expect(screen.getByText('UD Baru')).toBeInTheDocument()
    // Exact, case-sensitive: the row's pill reads "Perlu dilengkapi"; the
    // banner's own sentence reads lowercase "perlu dilengkapi" and would
    // also match a looser query, since both are present with one supplier
    // flagged.
    expect(screen.getByText('Perlu dilengkapi')).toBeInTheDocument()
  })
})

describe('Supplier: the reminder banner', () => {
  it('shows the banner with the right count, and none when there is nothing to review', async () => {
    await db.suppliersProj.bulkPut([
      { id: 's1', nama: 'UD Baru', perluDilengkapi: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' },
      { id: 's2', nama: 'UD Kedua', perluDilengkapi: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e2' },
    ])
    render(<Supplier />)

    expect(await screen.findByText(/2 supplier baru perlu dilengkapi/i)).toBeInTheDocument()
  })

  it('shows no banner when nothing needs review', async () => {
    await db.suppliersProj.put({ id: 's1', nama: 'CV Maju', perluDilengkapi: false, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    render(<Supplier />)

    await screen.findByText('CV Maju')
    expect(screen.queryByText(/perlu dilengkapi/i)).toBeNull()
  })
})

describe('Supplier: create and edit clear the flag', () => {
  it('creates a supplier via the sheet', async () => {
    const user = userEvent.setup()
    render(<Supplier />)
    await screen.findByText(/belum ada supplier/i)

    await user.click(screen.getByRole('button', { name: /supplier baru/i }))
    await user.type(screen.getByLabelText(/^nama/i), 'CV Maju')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(await screen.findByText('CV Maju')).toBeInTheDocument()
  })

  it('saving the edit sheet clears perluDilengkapi', async () => {
    await db.suppliersProj.put({ id: 's1', nama: 'UD Baru', perluDilengkapi: true, updatedAt: '2026-09-18T07:00:00.000Z', updatedByEventId: 'e1' })
    const user = userEvent.setup()
    render(<Supplier />)

    await user.click(await screen.findByText('UD Baru'))
    // openEdit is async (it reads db.batchesProj before opening the sheet),
    // so the Simpan button isn't there synchronously after the click.
    await user.click(await screen.findByRole('button', { name: /simpan/i }))

    // handleSubmit is itself async (updateSupplier is a real IndexedDB
    // write before the sheet closes), so the pill's removal is not
    // synchronous with the click either - wait for it to actually go.
    await waitFor(() => expect(screen.queryByText('Perlu dilengkapi')).toBeNull())
    expect(screen.getByText('UD Baru')).toBeInTheDocument()
  })
})
