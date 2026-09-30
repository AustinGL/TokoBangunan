import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ProductCard } from './ProductCard'
import type { BarangRow, UkuranRow } from '../shared/useKatalog'

const ukuran50: UkuranRow = { id: 'i50', ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, quantity: 32, status: 'aman' }
const ukuran40: UkuranRow = { id: 'i40', ukuran: '40 kg', hargaEceran: 58000, stokMinimum: 10, diarsipkan: false, quantity: 0, status: 'habis' }
const barang: BarangRow = { barangId: 'b1', nama: 'Semen Tiga Roda', kategori: 'Semen', diarsipkan: false, virtual: false, ukuran: [ukuran50, ukuran40] }

describe('ProductCard', () => {
  it('renders the barang nama once, and one row per non-archived ukuran with its own price and add button', () => {
    render(<ProductCard barang={barang} onAdd={vi.fn()} />)

    expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.getByText('50 kg')).toBeInTheDocument()
    expect(screen.getByText('40 kg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tambah Semen Tiga Roda 50 kg ke keranjang' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tambah Semen Tiga Roda 40 kg ke keranjang' })).toBeInTheDocument()
  })

  it('hides an archived ukuran entirely', () => {
    const withArchived: BarangRow = { ...barang, ukuran: [ukuran50, { ...ukuran40, diarsipkan: true }] }
    render(<ProductCard barang={withArchived} onAdd={vi.fn()} />)

    expect(screen.queryByText('40 kg')).toBeNull()
  })

  it('gives every add button the shared control size', () => {
    render(<ProductCard barang={barang} onAdd={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Tambah Semen Tiga Roda 50 kg ke keranjang' })
    expect(button).toHaveClass('h-control', 'w-control')
  })

  it('clicking an ukuran row\'s add button calls onAdd with that exact ukuran row', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<ProductCard barang={barang} onAdd={onAdd} />)

    await user.click(screen.getByRole('button', { name: 'Tambah Semen Tiga Roda 40 kg ke keranjang' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(ukuran40)
  })

  it('colors an ukuran\'s stock line by status, text carrying the meaning (not colour alone)', () => {
    render(<ProductCard barang={barang} onAdd={vi.fn()} />)

    const habisLine = screen.getByText(/Habis/)
    expect(habisLine).toHaveClass('text-danger')
    expect(habisLine.textContent).toContain('Habis')
  })
})
