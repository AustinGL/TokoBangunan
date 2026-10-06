import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { BottomNav } from './BottomNav'

const renderNav = (path = '/', supplierAlertCount = 0, piutangAlertCount = 0) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav onNewTransaction={vi.fn()} supplierAlertCount={supplierAlertCount} piutangAlertCount={piutangAlertCount} syncStatus="tersinkron" pendingCount={0} />
    </MemoryRouter>,
  )

describe('BottomNav', () => {
  it('shows three tabs, the centre action, and the Lainnya button', () => {
    renderNav()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Kasir · transaksi baru' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lainnya' })).toBeInTheDocument()
  })

  it('has exactly five interactive targets in total', () => {
    const { container } = renderNav()
    const bar = container.querySelector('nav[aria-label="Navigasi telepon"]') as HTMLElement
    const interactiveTargets = bar.querySelectorAll('a, button, [tabindex]')
    expect(interactiveTargets).toHaveLength(5)
  })

  it('keeps Beranda, Stok and Piutang as real links, and does not turn Lainnya into one', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Beranda' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Stok' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Piutang' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Lainnya' })).toBeNull()
  })

  it('opens LainnyaSheet when the Lainnya button is activated', async () => {
    const user = userEvent.setup()
    renderNav()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Lainnya' }))

    expect(screen.getByRole('dialog', { name: 'Lainnya' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lainnya' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('gives every tab, the centre action and the Lainnya button the minimum tap-target class', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Beranda' })).toHaveClass('min-h-control')
    expect(screen.getByRole('link', { name: 'Stok' })).toHaveClass('min-h-control')
    expect(screen.getByRole('link', { name: 'Piutang' })).toHaveClass('min-h-control')
    expect(screen.getByRole('button', { name: 'Kasir · transaksi baru' })).toHaveClass('min-h-control', 'size-14')
    expect(screen.getByRole('button', { name: 'Lainnya' })).toHaveClass('min-h-control')
  })

  it('keeps the Kasir action outside the tab capsule, as its own button', () => {
    const { container } = renderNav()
    const kasir = screen.getByRole('button', { name: 'Kasir · transaksi baru' })
    const capsule = container.querySelector('.glass-panel')
    expect(capsule).not.toBeNull()
    expect(capsule!.contains(kasir)).toBe(false)
    expect(capsule!.contains(screen.getByRole('link', { name: 'Stok' }))).toBe(true)
  })

  it('marks Stok as the current destination when the route is active, and not Beranda', () => {
    renderNav('/stok')
    expect(screen.getByRole('link', { name: 'Stok' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Beranda' })).not.toHaveAttribute('aria-current')
  })

  it('keeps the centre Kasir action visible and marks it current on Kasir', () => {
    renderNav('/kasir')
    expect(screen.getByRole('button', { name: 'Kasir · transaksi baru' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Kasir')).toBeInTheDocument()
  })

  it('marks Lainnya current for destinations that live in its sheet', () => {
    renderNav('/kamus')
    expect(screen.getByRole('button', { name: 'Lainnya' })).toHaveAttribute('aria-current', 'page')
  })

  it('folds the supplier alert count into the Lainnya button’s own accessible name', () => {
    renderNav('/', 2)
    expect(screen.getByRole('button', { name: 'Lainnya, 2 perlu dilengkapi' })).toBeInTheDocument()
  })

  it('shows no badge on the Piutang tab when nobody is lewat tempo', () => {
    renderNav('/', 0, 0)
    expect(screen.getByRole('link', { name: 'Piutang' })).not.toHaveAttribute('aria-label')
  })

  it('folds the number of customers lewat tempo into the Piutang tab’s own accessible name', () => {
    renderNav('/', 0, 3)
    expect(screen.getByRole('link', { name: 'Piutang, 3 lewat tempo' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Piutang' })).toBeNull()
  })

  it('keeps the Piutang tab a real link with the tap-target class when badged', () => {
    renderNav('/', 0, 1)
    expect(screen.getByRole('link', { name: 'Piutang, 1 lewat tempo' })).toHaveClass('min-h-control')
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('carries a distinct aria-label on its own nav landmark, so it can be told apart from Sidebar’s', () => {
    renderNav()
    expect(screen.getByRole('navigation', { name: 'Navigasi telepon' })).toBeInTheDocument()
  })
})

describe('BottomNav: account entry', () => {
  it('reaches the account screen from the Lainnya sheet', async () => {
    const user = userEvent.setup()
    renderNav()

    await user.click(screen.getByRole('button', { name: 'Lainnya' }))

    expect(screen.getByRole('link', { name: /akun dan cadangan/i })).toHaveAttribute('href', '/masuk')
  })
})
