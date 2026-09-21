import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { BottomNav } from './BottomNav'

const renderNav = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav onNewTransaction={vi.fn()} />
    </MemoryRouter>,
  )

describe('BottomNav', () => {
  it('shows four tabs plus the centre action, staying within the 5 target limit', () => {
    renderNav()
    expect(screen.getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toBeInTheDocument()
  })

  it('has exactly five interactive targets in total, not just four links plus a named button', () => {
    // Counting links and separately asserting a named button exists (the
    // test above) does not bound the total: a sixth target, such as an
    // extra icon button, could be added without either assertion catching
    // it. This counts every link, button, and explicitly-tabbable element
    // in the bar together, so a sixth target fails this test.
    const { container } = renderNav()
    const interactiveTargets = container.querySelectorAll('a, button, [tabindex]')
    expect(interactiveTargets).toHaveLength(5)
  })

  it('keeps Stok on the bar and folds Transaksi into Lainnya', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Stok' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Lainnya' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Transaksi' })).toBeNull()
  })

  it('gives every tab the minimum tap-target class, and sizes the centre action past it explicitly', () => {
    // As in TopNav: jsdom cannot measure a rendered pixel height, so this
    // pins token classes as a regression guard, not proof that anything
    // renders at 44px. The four tabs use the min-h-tap token directly. The
    // centre FAB does not use that class in this implementation - it is
    // sized with explicit h-14/w-14 (56px), which already clears the 44px
    // floor by a larger, fixed amount, so it is pinned by its own size
    // classes rather than the token.
    renderNav()
    expect(screen.getByRole('link', { name: 'Beranda' })).toHaveClass('min-h-tap')
    expect(screen.getByRole('link', { name: 'Stok' })).toHaveClass('min-h-tap')
    expect(screen.getByRole('link', { name: 'Piutang' })).toHaveClass('min-h-tap')
    expect(screen.getByRole('link', { name: 'Lainnya' })).toHaveClass('min-h-tap')
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toHaveClass('h-14', 'w-14')
  })

  it('separates the centre action from the tabs it abuts', () => {
    // The four tabs stay edge-to-edge on purpose: they are full-height flex-1
    // targets far wider than 44px, and a gap between them would only open dead
    // strips along the bottom edge of a phone. The FAB is different - it is a
    // 56px circle wedged between two of them - so it carries the 8px
    // separation MASTER.md section 11 requires between adjacent targets.
    renderNav()
    expect(screen.getByRole('button', { name: 'Transaksi baru' })).toHaveClass('mx-2')
  })

  it('marks Stok as the current destination when the route is active, and not Beranda', () => {
    renderNav('/stok')
    expect(screen.getByRole('link', { name: 'Stok' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Beranda' })).not.toHaveAttribute('aria-current')
  })
})
