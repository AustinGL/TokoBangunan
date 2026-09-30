import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageHeader } from './PageHeader'

describe('PageHeader', () => {
  it('renders the title as the one page heading', () => {
    render(<PageHeader title="Stok" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Stok' })).toBeInTheDocument()
  })

  it('renders a subtitle and an action when given, and neither when not', () => {
    const { rerender } = render(
      <PageHeader title="Stok" subtitle="12 barang" action={<button type="button">Tambah</button>} />,
    )
    expect(screen.getByText('12 barang')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tambah' })).toBeInTheDocument()

    rerender(<PageHeader title="Stok" />)
    expect(screen.queryByText('12 barang')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
