import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

const renderSidebar = (path = '/', supplierAlertCount = 0) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar syncStatus="tersinkron" pendingCount={0} onNewTransaction={vi.fn()} supplierAlertCount={supplierAlertCount} />
    </MemoryRouter>,
  )

describe('Sidebar', () => {
  it('renders all seven destinations (five primary plus two data-master)', () => {
    renderSidebar()
    for (const label of ['Beranda', 'Transaksi', 'Stok', 'Piutang', 'Laporan', 'Kamus Barang', 'Supplier']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('exposes its link list under its own labeled navigation landmark', () => {
    renderSidebar()
    const nav = screen.getByRole('navigation', { name: 'Navigasi utama' })
    expect(within(nav).getByRole('link', { name: 'Stok' })).toBeInTheDocument()
  })

  it('marks the current destination for assistive technology', () => {
    renderSidebar('/stok')
    expect(screen.getByRole('link', { name: 'Stok' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Beranda' })).not.toHaveAttribute('aria-current')
  })

  it('exposes the primary action as a button inside a banner landmark, not a destination', () => {
    renderSidebar()
    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('button', { name: '+ Transaksi baru' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Kasir' })).toBeNull()
  })

  it('gives every destination link and the primary button the minimum tap-target class', () => {
    renderSidebar()
    for (const label of ['Beranda', 'Transaksi', 'Stok', 'Piutang', 'Laporan', 'Kamus Barang', 'Supplier']) {
      expect(screen.getByRole('link', { name: label })).toHaveClass('min-h-tap')
    }
    expect(screen.getByRole('button', { name: '+ Transaksi baru' })).toHaveClass('min-h-tap')
  })

  it('shows no supplier alert badge when supplierAlertCount is 0', () => {
    renderSidebar('/', 0)
    expect(screen.getByRole('link', { name: 'Supplier' })).not.toHaveAttribute('aria-label')
  })

  it('folds the supplier alert count into the link’s own accessible name when non-zero', () => {
    renderSidebar('/', 2)
    expect(screen.getByRole('link', { name: 'Supplier, 2 perlu dilengkapi' })).toBeInTheDocument()
    // Never announced a second way: the dot itself must stay aria-hidden
    // (NotifDot's own contract), so the count lives in exactly one place.
    expect(screen.queryByRole('link', { name: 'Supplier' })).toBeNull()
  })

  it('calls onNewTransaction when the primary button is clicked', async () => {
    const user = userEvent.setup()
    const onNewTransaction = vi.fn()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar syncStatus="tersinkron" pendingCount={0} onNewTransaction={onNewTransaction} supplierAlertCount={0} />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '+ Transaksi baru' }))

    expect(onNewTransaction).toHaveBeenCalledTimes(1)
  })

  it('shows the sync indicator', () => {
    renderSidebar()
    expect(screen.getByRole('status')).toHaveTextContent('Tersinkron')
  })
})
