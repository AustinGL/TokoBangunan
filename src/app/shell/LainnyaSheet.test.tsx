import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { LainnyaSheet } from './LainnyaSheet'
import type { SyncStatus } from '../../data/sync'

const renderSheet = (
  open: boolean,
  onClose = vi.fn(),
  supplierAlertCount = 0,
  syncStatus: SyncStatus = 'tersinkron',
  pendingCount = 0,
) =>
  render(
    <MemoryRouter>
      <LainnyaSheet open={open} onClose={onClose} supplierAlertCount={supplierAlertCount} syncStatus={syncStatus} pendingCount={pendingCount} />
    </MemoryRouter>,
  )

describe('LainnyaSheet', () => {
  it('is closed until opened', () => {
    renderSheet(false)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('links to Transaksi, Kamus Barang, Supplier and Laporan when open', () => {
    renderSheet(true)
    const dialog = screen.getByRole('dialog', { name: 'Lainnya' })
    expect(dialog).toBeInTheDocument()
    for (const [label, href] of [
      ['Transaksi', '/transaksi'],
      ['Kamus Barang', '/kamus'],
      ['Supplier', '/supplier'],
      ['Laporan', '/laporan'],
    ]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  it('closes when a destination link is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSheet(true, onClose)

    await user.click(screen.getByRole('link', { name: 'Transaksi' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('folds the supplier alert count into the Supplier link’s own accessible name', () => {
    renderSheet(true, vi.fn(), 3)
    expect(screen.getByRole('link', { name: 'Supplier, 3 perlu dilengkapi' })).toBeInTheDocument()
  })

  it('gives every destination link the minimum tap-target class', () => {
    renderSheet(true)
    for (const label of ['Transaksi', 'Kamus Barang', 'Supplier', 'Laporan']) {
      expect(screen.getByRole('link', { name: label })).toHaveClass('min-h-control')
    }
  })
})

describe('LainnyaSheet: account entry', () => {
  it('links to the account screen and shows the backup status there, since a phone has no sidebar indicator', () => {
    renderSheet(true, vi.fn(), 0, 'belum-masuk', 5)

    const link = screen.getByRole('link', { name: /akun dan cadangan/i })
    expect(link).toHaveAttribute('href', '/masuk')
    expect(link).toHaveTextContent('Belum masuk · 5 belum tercadangkan')
  })

  it('closes when the account link is chosen', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderSheet(true, onClose)

    await user.click(screen.getByRole('link', { name: /akun dan cadangan/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('leaves it out when the shop is local-only', () => {
    renderSheet(true, vi.fn(), 0, 'lokal')

    expect(screen.queryByRole('link', { name: /akun dan cadangan/i })).toBeNull()
  })

  it('keeps it out of the page while the sheet is closed, so the sidebar status is not doubled', () => {
    renderSheet(false)

    expect(screen.queryByText('Akun dan cadangan')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
