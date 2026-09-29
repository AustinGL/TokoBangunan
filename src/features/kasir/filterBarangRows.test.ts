import { describe, it, expect } from 'vitest'
import { filterBarangRows } from './filterBarangRows'
import type { BarangRow } from '../shared/useKatalog'

const semen: BarangRow = {
  barangId: 'b1', nama: 'Semen Tiga Roda', kategori: 'Semen', diarsipkan: false, virtual: false,
  ukuran: [
    { id: 'i1', ukuran: '50 kg', barcode: '8991234567890', hargaEceran: 65000, stokMinimum: 10, diarsipkan: false, quantity: 32, status: 'aman' },
    { id: 'i2', ukuran: '40 kg', hargaEceran: 58000, stokMinimum: 10, diarsipkan: true, quantity: 0, status: 'habis' },
  ],
}
const pasir: BarangRow = {
  barangId: 'b2', nama: 'Pasir Halus', kategori: 'Pasir', diarsipkan: false, virtual: false,
  ukuran: [{ id: 'i3', ukuran: 'm3', hargaEceran: 180000, stokMinimum: 2, diarsipkan: false, quantity: 5, status: 'aman' }],
}
const rows = [semen, pasir]

describe('filterBarangRows', () => {
  it('matches by barang nama', () => {
    expect(filterBarangRows(rows, 'semen', null).map(r => r.barangId)).toEqual(['b1'])
  })

  it('matches by a non-archived ukuran\'s own ukuran text', () => {
    expect(filterBarangRows(rows, '50 kg', null).map(r => r.barangId)).toEqual(['b1'])
  })

  it('does not match an archived ukuran\'s text', () => {
    expect(filterBarangRows(rows, '40 kg', null)).toEqual([])
  })

  it('matches by a non-archived ukuran\'s barcode', () => {
    expect(filterBarangRows(rows, '8991234567890', null).map(r => r.barangId)).toEqual(['b1'])
  })

  it('narrows by kategori', () => {
    expect(filterBarangRows(rows, '', 'Pasir').map(r => r.barangId)).toEqual(['b2'])
  })

  it('returns everything for an empty query and null kategori', () => {
    expect(filterBarangRows(rows, '', null)).toHaveLength(2)
  })
})
