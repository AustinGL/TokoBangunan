import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { Sidebar } from './Sidebar'

const renderSidebar = (path = '/', supplierAlertCount = 0, piutangAlertCount = 0) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar syncStatus="tersinkron" pendingCount={0} onNewTransaction={vi.fn()} supplierAlertCount={supplierAlertCount} piutangAlertCount={piutangAlertCount} />
    </MemoryRouter>,
  )

describe('Sidebar', () => {
  it('renders all ten destinations (six primary plus four data-master)', () => {
    renderSidebar()
    for (const label of ['Beranda', 'Transaksi', 'Stok', 'Piutang', 'Laporan', 'Biaya', 'Kamus Barang', 'Kategori', 'Pelanggan', 'Supplier']) {
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

  it('marks the primary action current while the Kasir workspace is open', () => {
    renderSidebar('/kasir')
    expect(screen.getByRole('button', { name: '+ Transaksi baru' })).toHaveAttribute('aria-current', 'page')
  })

  it('gives every destination link and the primary button the minimum tap-target class', () => {
    renderSidebar()
    for (const label of ['Beranda', 'Transaksi', 'Stok', 'Piutang', 'Laporan', 'Biaya', 'Kamus Barang', 'Kategori', 'Pelanggan', 'Supplier']) {
      expect(screen.getByRole('link', { name: label })).toHaveClass('min-h-control')
    }
    expect(screen.getByRole('button', { name: '+ Transaksi baru' })).toHaveClass('h-control')
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

  it('shows no piutang badge when nobody is lewat tempo', () => {
    renderSidebar('/', 0, 0)
    expect(screen.getByRole('link', { name: 'Piutang' })).not.toHaveAttribute('aria-label')
  })

  it('folds the number of customers lewat tempo into the Piutang link’s own accessible name', () => {
    renderSidebar('/', 0, 2)
    expect(screen.getByRole('link', { name: 'Piutang, 2 lewat tempo' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Piutang' })).toBeNull()
  })

  it('keeps the supplier and piutang badges independent', () => {
    renderSidebar('/', 3, 1)
    expect(screen.getByRole('link', { name: 'Supplier, 3 perlu dilengkapi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Piutang, 1 lewat tempo' })).toBeInTheDocument()
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

describe('Sidebar: account entry', () => {
  it('turns the sync indicator into a link to the account screen', () => {
    renderSidebar()

    const link = screen.getByRole('link', { name: /tersinkron/i })
    expect(link).toHaveAttribute('href', '/masuk')
    expect(within(link).getByRole('status')).toHaveTextContent('Tersinkron')
  })

  it('says where the link goes when the owner is not signed in', () => {
    render(
      <MemoryRouter>
        <Sidebar syncStatus="belum-masuk" pendingCount={3} onNewTransaction={vi.fn()} supplierAlertCount={0} />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: /belum masuk · 3 belum tercadangkan.*buka akun/i })
    expect(link).toHaveAttribute('href', '/masuk')
  })

  it('leaves the indicator plain when the shop is local-only, since there is nothing to sign in to', () => {
    render(
      <MemoryRouter>
        <Sidebar syncStatus="lokal" pendingCount={0} onNewTransaction={vi.fn()} supplierAlertCount={0} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Hanya di perangkat ini')
    expect(screen.queryByRole('link', { name: /hanya di perangkat ini/i })).toBeNull()
  })
})
