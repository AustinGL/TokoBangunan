import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import type { UkuranRow } from '../shared/useKatalog'
import type { StokBarangRow } from './stokList'
import { StokRow } from './StokRow'
import { rupiah } from '../../domain/money'

const ukuran = (over: Partial<UkuranRow> & Pick<UkuranRow, 'id' | 'ukuran'>): UkuranRow => ({
  barcode: undefined, hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, quantity: 32, status: 'aman', ...over,
})

const row = (over: Partial<StokBarangRow> = {}): StokBarangRow => ({
  barangId: 'b1', nama: 'Semen Tiga Roda', kategori: 'Semen', virtual: false, status: 'aman',
  ukuran: [ukuran({ id: 'u1', ukuran: '50 kg' })], hargaMin: rupiah(65000), hargaMax: rupiah(65000), ...over,
})

const renderRow = (r: StokBarangRow) => render(<MemoryRouter><ul><li><StokRow row={r} /></li></ul></MemoryRouter>)

describe('StokRow', () => {
  it('links to the barang detail page and shows name, kategori, status, chips and price', () => {
    renderRow(row())
    const link = screen.getByRole('link', { name: /semen tiga roda/i })
    expect(link).toHaveAttribute('href', '/stok/b1')
    expect(within(link).getByText('Semen')).toBeInTheDocument()
    expect(within(link).getByText('Aman')).toBeInTheDocument()
    expect(within(link).getByText('50 kg · 32')).toBeInTheDocument()
    expect(within(link).getByText('Rp 65.000')).toBeInTheDocument()
  })

  it('shows a price range when the ukuran differ in price', () => {
    renderRow(row({ hargaMin: rupiah(58000), hargaMax: rupiah(65000) }))
    expect(screen.getByText('Rp 58.000 - Rp 65.000')).toBeInTheDocument()
  })

  it('marks a habis row with a status bar and the word Habis, and an aman row with no bar', () => {
    const { container, rerender } = render(
      <MemoryRouter><StokRow row={row({ status: 'habis', ukuran: [ukuran({ id: 'u1', ukuran: '50 kg', quantity: 0, status: 'habis' })] })} /></MemoryRouter>,
    )
    expect(screen.getByText('Habis')).toBeInTheDocument()
    expect(container.querySelector('.bg-danger')).not.toBeNull()

    rerender(<MemoryRouter><StokRow row={row()} /></MemoryRouter>)
    expect(container.querySelector('.bg-danger, .bg-warning')).toBeNull()
  })

  it('omits the kategori line when there is none', () => {
    renderRow(row({ kategori: undefined }))
    expect(screen.queryByText('Semen')).toBeNull()
  })
})
