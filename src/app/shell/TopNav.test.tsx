import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { TopNav } from './TopNav'

const renderNav = (onNewTransaction = vi.fn()) => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <TopNav syncStatus="tersinkron" pendingCount={0} onNewTransaction={onNewTransaction} />
    </MemoryRouter>,
  )
  return onNewTransaction
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

  it('exposes the primary action as a button, not a destination', () => {
    renderNav()
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Kasir' })).toBeNull()
  })

  it('opens Kasir on F2 from anywhere', async () => {
    const onNewTransaction = renderNav()
    await userEvent.keyboard('{F2}')
    expect(onNewTransaction).toHaveBeenCalledTimes(1)
  })

  it('shows the sync indicator', () => {
    renderNav()
    expect(screen.getByRole('status')).toHaveTextContent('Tersinkron')
  })
})
