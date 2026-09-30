import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Plus } from 'lucide-react'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('is named by its label, type=button, square at control size', () => {
    render(<IconButton icon={Plus} label="Tambah supplier baru" />)
    const button = screen.getByRole('button', { name: 'Tambah supplier baru' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('h-control', 'w-control')
  })

  it('pill shape by default, field shape beside a form input', () => {
    render(<><IconButton icon={Plus} label="A" /><IconButton icon={Plus} label="B" shape="field" /></>)
    expect(screen.getByRole('button', { name: 'A' })).toHaveClass('rounded-pill')
    expect(screen.getByRole('button', { name: 'B' })).toHaveClass('rounded-field')
  })

  it('sm is the small control with a 44px hit area', () => {
    render(<IconButton icon={Plus} label="A" size="sm" />)
    const button = screen.getByRole('button', { name: 'A' })
    expect(button).toHaveClass('h-control-sm', 'w-control-sm')
    expect(button.className).toMatch(/before:-inset-1/)
  })

  it('disabled reads as disabled and ignores clicks', async () => {
    const onClick = vi.fn()
    render(<IconButton icon={Plus} label="A" disabled onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'A' })
    expect(button).toHaveClass('disabled:opacity-50')
    await userEvent.setup().click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('its glyph is decorative and 18px', () => {
    const { container } = render(<IconButton icon={Plus} label="A" />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '18')
  })
})
