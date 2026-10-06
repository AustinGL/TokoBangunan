import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressRing } from './ProgressRing'

const offsetOf = (el: HTMLElement) => Number(el.getAttribute('stroke-dashoffset'))
const circumference = (el: HTMLElement) => Number(el.getAttribute('stroke-dasharray'))

describe('ProgressRing', () => {
  it('fills the arc in proportion to the value', () => {
    render(<ProgressRing value={0.25} />)
    const arc = screen.getByTestId('ring-arc')
    expect(offsetOf(arc)).toBeCloseTo(circumference(arc) * 0.75, 5)
  })

  it('clamps out-of-range and non-finite values', () => {
    const { rerender } = render(<ProgressRing value={3} />)
    expect(offsetOf(screen.getByTestId('ring-arc'))).toBeCloseTo(0, 5)
    rerender(<ProgressRing value={-1} />)
    const arc = screen.getByTestId('ring-arc')
    expect(offsetOf(arc)).toBeCloseTo(circumference(arc), 5)
    rerender(<ProgressRing value={NaN} />)
    expect(offsetOf(screen.getByTestId('ring-arc'))).toBeCloseTo(circumference(screen.getByTestId('ring-arc')), 5)
  })

  it('renders its children as real text and hides the graphic from assistive tech', () => {
    const { container } = render(<ProgressRing value={0.5}><span>42 aman</span></ProgressRing>)
    expect(screen.getByText('42 aman')).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
