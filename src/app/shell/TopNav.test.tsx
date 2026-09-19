import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { TopNav } from './TopNav'

const renderNav = (onNewTransaction = vi.fn(), path = '/') => {
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <TopNav syncStatus="tersinkron" pendingCount={0} onNewTransaction={onNewTransaction} />
    </MemoryRouter>,
  )
  return { onNewTransaction, ...result }
}

describe('TopNav', () => {
  it('renders all six destinations', () => {
    renderNav()
    for (const label of ['Beranda', 'Transaksi', 'Stok', 'Piutang', 'Supplier', 'Laporan']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('marks the current destination for assistive technology', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Beranda' })).toHaveAttribute('aria-current', 'page')
  })

  it('moves aria-current to the active item on a non-default route, not just Beranda', () => {
    // The previous test only ever exercised the default route, so a bug that
    // hardcoded "current" onto Beranda regardless of location would slip
    // through. Starting on /stok proves aria-current tracks the route.
    renderNav(vi.fn(), '/stok')
    expect(screen.getByRole('link', { name: 'Stok' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Beranda' })).not.toHaveAttribute('aria-current')
  })

  it('exposes the primary action as a button, not a destination', () => {
    renderNav()
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Kasir' })).toBeNull()
  })

  it('gives every destination link and the primary button the minimum tap-target class', () => {
    // jsdom has no layout engine and cannot report a rendered pixel height,
    // so this cannot prove anything is actually 44px on screen. What it
    // pins is the token class (min-h-tap, which maps to 44px in
    // tailwind.config.js) staying on every destination and on the primary
    // button, as a regression guard rather than proof of layout.
    renderNav()
    for (const label of ['Beranda', 'Transaksi', 'Stok', 'Piutang', 'Supplier', 'Laporan']) {
      expect(screen.getByRole('link', { name: label })).toHaveClass('min-h-tap')
    }
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toHaveClass('min-h-tap')
  })

  it('opens Kasir on F2 from anywhere', async () => {
    const { onNewTransaction } = renderNav()
    await userEvent.keyboard('{F2}')
    expect(onNewTransaction).toHaveBeenCalledTimes(1)
  })

  it('still triggers F2 when focus sits on an unrelated element elsewhere on the page', async () => {
    const onNewTransaction = vi.fn()
    render(
      <MemoryRouter initialEntries={['/']}>
        <input aria-label="bidang lain" />
        <TopNav syncStatus="tersinkron" pendingCount={0} onNewTransaction={onNewTransaction} />
      </MemoryRouter>,
    )
    const elsewhere = screen.getByRole('textbox', { name: 'bidang lain' })
    await userEvent.click(elsewhere)
    expect(elsewhere).toHaveFocus()

    await userEvent.keyboard('{F2}')

    expect(onNewTransaction).toHaveBeenCalledTimes(1)
  })

  it('stops listening for F2 once unmounted, so it cannot fire twice after a route change', async () => {
    const onNewTransaction = vi.fn()
    const { unmount } = renderNav(onNewTransaction)

    await userEvent.keyboard('{F2}')
    expect(onNewTransaction).toHaveBeenCalledTimes(1)

    unmount()
    await userEvent.keyboard('{F2}')

    // Still 1: a leaked global keydown listener would make this 2.
    expect(onNewTransaction).toHaveBeenCalledTimes(1)
  })

  it('shows the sync indicator', () => {
    renderNav()
    expect(screen.getByRole('status')).toHaveTextContent('Tersinkron')
  })
})
