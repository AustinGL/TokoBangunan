import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('renders nothing for an empty series', () => {
    const { container } = render(<Sparkline values={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('draws a path and hides itself from assistive tech', () => {
    const { container } = render(<Sparkline values={[1, 3, 2, 5]} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M /)
  })

  it('draws a flat series without NaN coordinates', () => {
    const { container } = render(<Sparkline values={[0, 0, 0, 0, 0, 0, 0]} />)
    expect(container.querySelector('path')?.getAttribute('d')).not.toMatch(/NaN/)
  })

  it('draws a single point without NaN coordinates', () => {
    const { container } = render(<Sparkline values={[7]} />)
    expect(container.querySelector('path')?.getAttribute('d')).not.toMatch(/NaN/)
  })
})
