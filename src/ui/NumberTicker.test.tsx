import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NumberTicker } from './NumberTicker'

describe('NumberTicker', () => {
  it('renders its text as one plain text node, so it reads and queries like ordinary text', () => {
    render(<NumberTicker value={120000}>Rp 120.000</NumberTicker>)
    expect(screen.getByText('Rp 120.000')).toBeInTheDocument()
  })

  it('does not animate on first render, so a page does not twitch on load', () => {
    render(<NumberTicker value={5}>5</NumberTicker>)
    expect(screen.getByText('5')).not.toHaveClass('digit-in')
  })

  it('animates when the value changes, and keeps showing the new text', () => {
    const { rerender } = render(<NumberTicker value={5}>5</NumberTicker>)
    rerender(<NumberTicker value={6}>6</NumberTicker>)
    expect(screen.getByText('6')).toHaveClass('digit-in')
    expect(screen.queryByText('5')).toBeNull()
  })

  it('uses tabular numerals so digits do not shift width as they change', () => {
    render(<NumberTicker value={1}>1</NumberTicker>)
    expect(screen.getByText('1')).toHaveClass('tabular-nums')
  })
})
