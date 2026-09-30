import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { BottomNav } from './BottomNav'

const renderNav = (path = '/', supplierAlertCount = 0) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav onNewTransaction={vi.fn()} supplierAlertCount={supplierAlertCount} syncStatus="tersinkron" pendingCount={0} />
    </MemoryRouter>,
  )

describe('BottomNav', () => {
  it('shows three tabs, the centre action, and the Lainnya button', () => {
    renderNav()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toBeInTheDocument()
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
  })

  it('gives every tab, the centre action and the Lainnya button the minimum tap-target class', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Beranda' })).toHaveClass('min-h-control')
    expect(screen.getByRole('link', { name: 'Stok' })).toHaveClass('min-h-control')
    expect(screen.getByRole('link', { name: 'Piutang' })).toHaveClass('min-h-control')
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toHaveClass('h-14', 'w-14')
    expect(screen.getByRole('button', { name: 'Lainnya' })).toHaveClass('min-h-control')
  })

  it('separates the centre action from the tabs it abuts', () => {
    renderNav()
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toHaveClass('mx-2')
  })

  it('marks Stok as the current destination when the route is active, and not Beranda', () => {
    renderNav('/stok')
    expect(screen.getByRole('link', { name: 'Stok' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Beranda' })).not.toHaveAttribute('aria-current')
  })

  it('folds the supplier alert count into the Lainnya button’s own accessible name', () => {
    renderNav('/', 2)
    expect(screen.getByRole('button', { name: 'Lainnya, 2 perlu dilengkapi' })).toBeInTheDocument()
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
