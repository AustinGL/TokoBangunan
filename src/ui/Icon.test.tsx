import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Plus } from 'lucide-react'
import { Icon, ICON_SIZE } from './Icon'

describe('Icon', () => {
  it('defaults to the button size, stroke 2, decorative', () => {
    const { container } = render(<Icon icon={Plus} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('width', String(ICON_SIZE.button))
    expect(svg).toHaveAttribute('height', String(ICON_SIZE.button))
    expect(svg).toHaveAttribute('stroke-width', '2')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it.each(['micro', 'inline', 'button', 'nav', 'fab'] as const)('renders the %s size from the token table', size => {
    const { container } = render(<Icon icon={Plus} size={size} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', String(ICON_SIZE[size]))
  })

  it('has exactly the agreed sizes', () => {
    expect(ICON_SIZE).toEqual({ micro: 12, inline: 16, button: 18, nav: 20, fab: 24 })
  })

  it('passes className through', () => {
    const { container } = render(<Icon icon={Plus} className="shrink-0" />)
    expect(container.querySelector('svg')).toHaveClass('shrink-0')
  })
})
