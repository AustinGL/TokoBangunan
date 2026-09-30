import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertCircle } from 'lucide-react'
import { describe, it, expect, vi } from 'vitest'
import { StatTile } from './StatTile'

describe('StatTile', () => {
  it('is a plain figure, not a button, without onClick', () => {
    render(<StatTile label="Transaksi" value={7} icon={AlertCircle} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Transaksi')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('is a toggle button named "label: value" with onClick, and reports its pressed state', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<StatTile label="Habis" value={3} icon={AlertCircle} onClick={onClick} pressed={false} />)

    const tile = screen.getByRole('button', { name: 'Habis: 3' })
    expect(tile).toHaveAttribute('aria-pressed', 'false')
    await user.click(tile)
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<StatTile label="Habis" value={3} icon={AlertCircle} onClick={onClick} pressed />)
    expect(screen.getByRole('button', { name: 'Habis: 3' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Habis: 3' })).toHaveClass('border-primary')
  })

  it('tints its icon by tone', () => {
    const { container } = render(<StatTile label="Habis" value={3} icon={AlertCircle} tone="danger" />)
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-danger-bg')
  })

  it('accepts extra classes for its grid cell', () => {
    const { container } = render(<StatTile label="Penjualan" value="Rp 1" icon={AlertCircle} className="col-span-2" />)
    expect(container.firstElementChild).toHaveClass('col-span-2')
  })

  it('never splits a long figure across lines, and stacks icon over number until the wide breakpoint', () => {
    const { container } = render(<StatTile label="Penjualan" value="Rp 123.456.789" icon={AlertCircle} />)
    // Rp 123.456.789 must stay one piece: a money total broken mid-number is misread.
    expect(screen.getByText('Rp 123.456.789')).toHaveClass('whitespace-nowrap')
    expect(screen.getByText('Rp 123.456.789')).not.toHaveClass('break-words')
    // Side-by-side icon and number only where a tile is wide enough for the figure (xl), never at md/lg.
    expect(container.firstElementChild).toHaveClass('xl:flex-row')
    expect(container.firstElementChild).not.toHaveClass('md:flex-row')
  })
})
