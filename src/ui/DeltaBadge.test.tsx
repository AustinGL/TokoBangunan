import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeltaBadge } from './DeltaBadge'

describe('DeltaBadge', () => {
  it('shows a plus sign and the success tone for growth', () => {
    render(<DeltaBadge value={9.3} />)
    expect(screen.getByText('+ 9,3%').className).toMatch(/text-success/)
  })

  it('shows a minus sign and the danger tone for a drop', () => {
    render(<DeltaBadge value={-4} />)
    expect(screen.getByText('− 4%').className).toMatch(/text-danger/)
  })

  it('shows a neutral 0% for no change', () => {
    render(<DeltaBadge value={0} />)
    expect(screen.getByText('0%').className).toMatch(/text-neutral/)
  })

  it('renders nothing when there is nothing to compare to', () => {
    const { container } = render(<DeltaBadge value={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
