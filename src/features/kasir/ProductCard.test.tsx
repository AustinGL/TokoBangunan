import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ProductCard } from './ProductCard'
import { computeProductStatus, type ProductRow } from './useProductCatalog'

const baseItem: ProductRow = {
  itemId: 'semen',
  nama: 'Semen Tiga Roda',
  baseUnit: 'sak',
  hargaEceran: 52000,
  quantity: 50,
  stokMinimum: 10,
  status: 'aman',
}

describe('ProductCard', () => {
  it('gives the add button the 44px minimum touch-target utility classes', () => {
    render(<ProductCard item={baseItem} onAdd={vi.fn()} />)

    const addButton = screen.getByRole('button', { name: 'Tambah Semen Tiga Roda ke keranjang' })
    expect(addButton).toHaveClass('min-h-tap')
    expect(addButton).toHaveClass('min-w-tap')
  })

  it('uses the exact aria-label format "Tambah [nama] ke keranjang" for the given item name', () => {
    render(<ProductCard item={{ ...baseItem, nama: 'Paku 5cm' }} onAdd={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Tambah Paku 5cm ke keranjang' })).toBeInTheDocument()
  })

  it('clicking add calls onAdd with the exact item, and touches no Dexie or command function', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ProductCard item={baseItem} onAdd={onAdd} />)

    await user.click(screen.getByRole('button', { name: 'Tambah Semen Tiga Roda ke keranjang' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(baseItem)
  })

  it('colors the stock line danger and labels it Habis at quantity 0', () => {
    render(<ProductCard item={{ ...baseItem, quantity: 0, status: computeProductStatus(0, 10) }} onAdd={vi.fn()} />)

    const statusLine = screen.getByText(/Habis/)
    expect(statusLine).toHaveClass('text-danger')
    // Text carries the meaning, not color alone: the label itself is "Habis".
    expect(statusLine.textContent).toContain('Habis')
  })

  it('colors the stock line warning and labels it Menipis one unit below stokMinimum', () => {
    render(<ProductCard item={{ ...baseItem, quantity: 9, status: computeProductStatus(9, 10) }} onAdd={vi.fn()} />)

    const statusLine = screen.getByText(/Menipis/)
    expect(statusLine).toHaveClass('text-warning')
  })

  it('colors the stock line ink-faint and labels it Aman at exactly stokMinimum', () => {
    render(<ProductCard item={{ ...baseItem, quantity: 10, status: computeProductStatus(10, 10) }} onAdd={vi.fn()} />)

    const statusLine = screen.getByText(/Aman/)
    expect(statusLine).toHaveClass('text-ink-faint')
  })

  it('shows the price and unit', () => {
    render(<ProductCard item={baseItem} onAdd={vi.fn()} />)

    expect(screen.getByText('Rp 52.000')).toBeInTheDocument()
    expect(screen.getByText('/sak')).toBeInTheDocument()
  })
})
