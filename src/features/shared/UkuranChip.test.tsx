import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { UkuranChip } from './UkuranChip'

describe('UkuranChip', () => {
  it('shows "ukuran · quantity" as one piece of text', () => {
    render(<UkuranChip ukuran="50 kg" quantity={32} status="aman" />)
    expect(screen.getByText('50 kg · 32')).toBeInTheDocument()
  })

  it('adds no status word or icon for aman', () => {
    const { container } = render(<UkuranChip ukuran="50 kg" quantity={32} status="aman" />)
    expect(screen.queryByText(/stok/i)).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('says the status in words for screen readers, never by colour alone, for habis and menipis', () => {
    const { container, rerender } = render(<UkuranChip ukuran="40 kg" quantity={0} status="habis" />)
    expect(screen.getByText('stok habis')).toHaveClass('sr-only')
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container.firstElementChild).toHaveClass('bg-danger-bg', 'text-danger')

    rerender(<UkuranChip ukuran="40 kg" quantity={3} status="menipis" />)
    expect(screen.getByText('stok menipis')).toHaveClass('sr-only')
    expect(container.firstElementChild).toHaveClass('bg-warning-bg', 'text-warning')
  })

  it('never uses the exact word the StatusPill renders, so a row can be searched for "Habis" unambiguously', () => {
    render(<UkuranChip ukuran="40 kg" quantity={0} status="habis" />)
    expect(screen.queryByText('Habis')).toBeNull()
  })
})
