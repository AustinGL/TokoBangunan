import { render, screen } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { describe, it, expect } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('shows its sentence in one element, and an action when given', () => {
    render(
      <EmptyState icon={BookOpen} action={<a href="/kamus">Buka Kamus Barang</a>}>
        Belum ada stok. Tambahkan barang di menu Kamus Barang.
      </EmptyState>,
    )
    expect(screen.getByText('Belum ada stok. Tambahkan barang di menu Kamus Barang.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buka Kamus Barang' })).toBeInTheDocument()
  })

  it('has no action when none is given', () => {
    render(<EmptyState icon={BookOpen}>Kosong.</EmptyState>)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
