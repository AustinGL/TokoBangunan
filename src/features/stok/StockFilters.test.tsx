import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import type { BarangRow, UkuranRow } from '../shared/useKatalog'
import { StockFilters } from './StockFilters'
import { toStokRows, filterStokRows, EMPTY_STOK_FILTERS, type StokFilterState } from './stokList'

const ukuran = (over: Partial<UkuranRow> & Pick<UkuranRow, 'id' | 'ukuran'>): UkuranRow => ({
  barcode: undefined, hargaEceran: 50000, stokMinimum: 10, diarsipkan: false, quantity: 10, status: 'aman', ...over,
})

const barang = (over: Partial<BarangRow> & Pick<BarangRow, 'barangId' | 'nama' | 'ukuran'>): BarangRow => ({
  kategori: undefined, diarsipkan: false, virtual: false, ...over,
})

const rows = toStokRows([
  barang({ barangId: 'a', nama: 'Semen Tiga Roda', kategori: 'Semen', ukuran: [ukuran({ id: 'a1', ukuran: '50 kg', barcode: '111222', status: 'aman' })] }),
  barang({ barangId: 'b', nama: 'Cat Tembok Putih', kategori: 'Cat', ukuran: [ukuran({ id: 'b1', ukuran: '5 kg', barcode: '333444', status: 'habis', quantity: 0 })] }),
  barang({ barangId: 'c', nama: 'Semen Putih', kategori: 'Semen', ukuran: [ukuran({ id: 'c1', ukuran: '40 kg', status: 'menipis' })] }),
])

// A tiny harness wires StockFilters (a controlled component) up to
// filterStokRows and renders the narrowed result, so the tests below can
// assert on real filtering behavior rather than just that state changed.
function Harness({ categories = ['Semen', 'Cat'] }: { categories?: string[] }) {
  const [filters, setFilters] = useState<StokFilterState>(EMPTY_STOK_FILTERS)
  const visible = filterStokRows(rows, filters)
  return (
    <div>
      <StockFilters categories={categories} filters={filters} onChange={setFilters} />
      <ul>
        {visible.map(row => (
          <li key={row.barangId}>{row.nama}</li>
        ))}
      </ul>
    </div>
  )
}

describe('StockFilters', () => {
  it('advertises the new search scope (nama, ukuran, or barcode) in its placeholder', () => {
    render(<Harness />)
    expect(screen.getByPlaceholderText('Nama, ukuran, atau barcode')).toBeInTheDocument()
  })

  it('narrows the list by a nama substring, case-insensitively', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/cari barang/i), 'putih')

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.getByText('Semen Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
  })

  it('narrows the list by an ukuran text substring', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/cari barang/i), '5 kg')

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
    expect(screen.queryByText('Semen Putih')).toBeNull()
  })

  it('narrows the list by a barcode substring', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText(/cari barang/i), '3334')

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
    expect(screen.queryByText('Semen Putih')).toBeNull()
  })

  it('narrows the list from the Kategori dropdown', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: /kategori/i }))
    await user.click(screen.getByRole('option', { name: 'Cat' }))

    expect(screen.getByText('Cat Tembok Putih')).toBeInTheDocument()
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()
    expect(screen.queryByText('Semen Putih')).toBeNull()
  })

  it('combines search and kategori filters', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('combobox', { name: /kategori/i }))
    await user.click(screen.getByRole('option', { name: 'Semen' }))
    await user.type(screen.getByLabelText(/cari barang/i), 'tiga')

    expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.queryByText('Semen Putih')).toBeNull()
    expect(screen.queryByText('Cat Tembok Putih')).toBeNull()
  })

  it('offers Reset filter only while a filter is active, and it restores the full list', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.queryByRole('button', { name: 'Reset filter' })).toBeNull()

    await user.type(screen.getByLabelText(/cari barang/i), 'putih')
    expect(screen.queryByText('Semen Tiga Roda')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Reset filter' }))

    expect(screen.getByLabelText(/cari barang/i)).toHaveValue('')
    expect(screen.getByText('Semen Tiga Roda')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset filter' })).toBeNull()
  })

  it('has no Kategori dropdown when there are no kategori to choose from', () => {
    render(<Harness categories={[]} />)
    expect(screen.queryByRole('combobox', { name: /kategori/i })).toBeNull()
  })
})
