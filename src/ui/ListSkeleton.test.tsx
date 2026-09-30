import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ListSkeleton } from './ListSkeleton'

describe('ListSkeleton', () => {
  it('announces its label as a busy status', () => {
    render(<ListSkeleton label="Memuat daftar stok..." />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Memuat daftar stok...')
  })

  it('draws four hidden placeholder rows by default, or as many as asked', () => {
    const { container, rerender } = render(<ListSkeleton label="x" />)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4)

    rerender(<ListSkeleton label="x" rows={2} />)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })
})
