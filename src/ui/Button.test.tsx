import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { Plus } from 'lucide-react'
import { Button, ButtonLink } from './Button'

describe('Button', () => {
  it('is type=button by default so it never submits a form by accident', () => {
    render(<Button>Simpan</Button>)
    expect(screen.getByRole('button', { name: 'Simpan' })).toHaveAttribute('type', 'button')
  })

  it('can be a submit button', () => {
    render(<Button type="submit">Simpan</Button>)
    expect(screen.getByRole('button', { name: 'Simpan' })).toHaveAttribute('type', 'submit')
  })

  it('md is control height, sm is the small control height with a padded hit area', () => {
    render(<><Button>Besar</Button><Button size="sm">Kecil</Button></>)
    expect(screen.getByRole('button', { name: 'Besar' })).toHaveClass('h-control')
    const small = screen.getByRole('button', { name: 'Kecil' })
    expect(small).toHaveClass('h-control-sm')
    expect(small.className).toMatch(/before:-inset-y-1/)
  })

  it.each([
    ['primary', 'bg-[var(--btn-primary-bg)]'],
    ['secondary', 'border-[var(--btn-secondary-bd)]'],
    ['ghost', 'text-ink-muted'],
    ['danger', 'text-danger'],
    ['link', 'underline'],
  ] as const)('the %s variant carries its own look', (variant, cls) => {
    render(<Button variant={variant}>X</Button>)
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass(cls)
  })

  it('shows disabled state and does not fire onClick', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>X</Button>)
    const button = screen.getByRole('button', { name: 'X' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed')
    await userEvent.setup().click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders an optional leading icon, decorative', () => {
    const { container } = render(<Button icon={Plus}>Tambah</Button>)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('fullWidth stretches it', () => {
    render(<Button fullWidth>X</Button>)
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass('w-full')
  })
})

describe('ButtonLink', () => {
  it('renders a router link with the same look', () => {
    render(<MemoryRouter><ButtonLink to="/stok" variant="secondary">Ke stok</ButtonLink></MemoryRouter>)
    const link = screen.getByRole('link', { name: 'Ke stok' })
    expect(link).toHaveAttribute('href', '/stok')
    expect(link).toHaveClass('h-control', 'rounded-pill')
  })
})
