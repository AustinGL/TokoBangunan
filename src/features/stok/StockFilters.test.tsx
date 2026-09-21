import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { StockFilters } from './StockFilters'
import { filterStokRows, EMPTY_STOK_FILTERS, type StokFilterState, type StokRow } from './useStokList'

const rows: StokRow[] = [
  { itemId: 'a', nama: 'Semen Tiga Roda', baseUnit: 'sak', kategori: 'Semen', hargaEceran: 52000, stokMinimum: 10, quantity: 50, status: 'aman', barcode: '111222' },
  { itemId: 'b', nama: 'Cat Tembok Putih', baseUnit: 'kaleng', kategori: 'Cat', hargaEceran: 95000, stokMinimum: 5, quantity: 0, status: 'habis', barcode: '333444' },
  { itemId: 'c', nama: 'Semen Putih', baseUnit: 'sak', kategori: 'Semen', hargaEceran: 60000, stokMinimum: 10, quantity: 3, status: 'menipis', barcode: '555666' },
]

// A tiny harness wires StockFilters (a controlled component) up to
// filterStokRows and renders the narrowed result, so the tests below can
// assert on real filtering behavior rather than just that state changed.
function Harness() {
  const [filters, setFilters] = useState<StokFilterState>(EMPTY_STOK_FILTERS)
  const visible = filterStokRows(rows, filters)
  return (
    <div>
      <StockFilters categories={['Semen', 'Cat']} filters={filters} onChange={setFilters} />
      <ul>
        {visible.map(row => (
          <li key={row.itemId}>{row.nama}</li>
        ))}
      </ul>
    </div>
  )
}

describe('StockFilters', () => {
  it('narrows the list by a nama substring, case-insensitively', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/cari barang/i), 'putih')

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.getByText('Semen Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
  })

  it('narrows the list by a barcode substring', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/cari barang/i), '3334')

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
    expect(screen.queryByText('Semen Putih')).toBeNull()
  })

  it('narrows the list with the habis/menipis toggle', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Habis' }))

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
    expect(screen.queryByText('Semen Putih')).toBeNull()
  })

  it('narrows the list by kategori pill selection', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('radio', { name: 'Cat' }))

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
    expect(screen.queryByText('Semen Putih')).toBeNull()
  })

  it('combines search and kategori filters', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('radio', { name: 'Semen' }))
    await user.type(screen.getByLabelText(/cari barang/i), 'tiga')

    expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.queryByText('Semen Putih')).toBeNull()
    expect(screen.queryByText('Cat Tembok Putih')).toBeNull()
  })
})
