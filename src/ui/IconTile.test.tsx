import { render } from '@testing-library/react'
import { Package } from 'lucide-react'
import { describe, it, expect } from 'vitest'
import { IconTile } from './IconTile'

describe('IconTile', () => {
  it('is decorative and carries the tone colours', () => {
    const { container } = render(<IconTile icon={Package} tone="danger" />)
    const tile = container.firstElementChild!
    expect(tile).toHaveAttribute('aria-hidden', 'true')
    expect(tile).toHaveClass('bg-danger-bg', 'text-danger')
  })

  it('is a 40px rounded square by default and a compact rounded square when small', () => {
    const { container, rerender } = render(<IconTile icon={Package} />)
    expect(container.firstElementChild).toHaveClass('size-10', 'rounded-inner')

    rerender(<IconTile icon={Package} size="sm" />)
    expect(container.firstElementChild).toHaveClass('size-9', 'rounded-[10px]')
  })
})
