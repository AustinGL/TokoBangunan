import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NotifDot } from './NotifDot'

describe('NotifDot', () => {
  it('renders a purely decorative marker, hidden from assistive technology', () => {
    const { container } = render(<NotifDot />)
    const dot = container.firstElementChild
    expect(dot).not.toBeNull()
    expect(dot).toHaveAttribute('aria-hidden', 'true')
  })

  it('carries no text content or accessible name of its own', () => {
    // A caller is responsible for putting the meaning into the
    // destination's own accessible name (see Sidebar.test.tsx /
    // BottomNav.test.tsx); this component must never introduce a second,
    // competing announcement.
    const { container } = render(<NotifDot />)
    expect(container.textContent).toBe('')
  })

  it('exposes no role at all', () => {
    render(<NotifDot />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
