import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { BottomNav } from './BottomNav'

const renderNav = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <BottomNav onNewTransaction={vi.fn()} />
    </MemoryRouter>,
  )

describe('BottomNav', () => {
  it('shows four tabs plus the centre action, staying within the 5 target limit', () => {
    renderNav()
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toBeInTheDocument()
  })

  it('keeps Stok on the bar and folds Transaksi into Lainnya', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Stok' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lainnya' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Transaksi' })).toBeNull()
  })
})
