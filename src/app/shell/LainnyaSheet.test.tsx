import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { LainnyaSheet } from './LainnyaSheet'

const renderSheet = (open: boolean, onClose = vi.fn(), supplierAlertCount = 0) =>
  render(
    <MemoryRouter>
      <LainnyaSheet open={open} onClose={onClose} supplierAlertCount={supplierAlertCount} />
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
      expect(screen.getByRole('link', { name: label })).toHaveClass('min-h-tap')
    }
  })
})
