import { describe, it, expect } from 'vitest'
import type { BarangRow, UkuranRow } from '../shared/useKatalog'
import { rupiah } from '../../domain/money'
import {
  toStokRows, filterStokRows, summarizeStokRows, EMPTY_STOK_FILTERS, type StokFilterState,
} from './stokList'

const ukuran = (over: Partial<UkuranRow> & Pick<UkuranRow, 'id' | 'ukuran'>): UkuranRow => ({
  barcode: undefined, hargaEceran: 50000, stokMinimum: 10, diarsipkan: false, quantity: 10, status: 'aman', ...over,
})

const barang = (over: Partial<BarangRow> & Pick<BarangRow, 'barangId' | 'nama' | 'ukuran'>): BarangRow => ({
  kategori: undefined, diarsipkan: false, virtual: false, ...over,
})

describe('toStokRows', () => {
  it('drops an archived barang entirely', () => {
    const rows = toStokRows([barang({ barangId: 'b1', nama: 'Arsip', diarsipkan: true, ukuran: [ukuran({ id: 'u1', ukuran: '50 kg' })] })])
    expect(rows).toHaveLength(0)
  })

  it('drops an archived ukuran but keeps the barang when another ukuran remains', () => {
    const rows = toStokRows([barang({
      barangId: 'b1', nama: 'Semen', ukuran: [
        ukuran({ id: 'u1', ukuran: '40 kg', diarsipkan: true }),
        ukuran({ id: 'u2', ukuran: '50 kg' }),
      ],
    })])
    expect(rows).toHaveLength(1)
    expect(rows[0].ukuran.map(u => u.id)).toEqual(['u2'])
  })

  it('drops a barang whose every ukuran is archived, rather than showing an empty row', () => {
    const rows = toStokRows([barang({
      barangId: 'b1', nama: 'Semen', ukuran: [ukuran({ id: 'u1', ukuran: '40 kg', diarsipkan: true })],
    })])
    expect(rows).toHaveLength(0)
  })

  it('sets the row status to the worst status across its own ukuran, even when another ukuran is fine', () => {
    const rows = toStokRows([barang({
      barangId: 'b1', nama: 'Semen', ukuran: [
        ukuran({ id: 'u1', ukuran: '40 kg', status: 'habis' }),
        ukuran({ id: 'u2', ukuran: '50 kg', status: 'aman' }),
      ],
    })])
    expect(rows[0].status).toBe('habis')
  })

  it('computes the harga range across its own ukuran', () => {
    const rows = toStokRows([barang({
      barangId: 'b1', nama: 'Semen', ukuran: [
        ukuran({ id: 'u1', ukuran: '40 kg', hargaEceran: 58000 }),
        ukuran({ id: 'u2', ukuran: '50 kg', hargaEceran: 65000 }),
      ],
    })])
    expect(rows[0].hargaMin).toBe(rupiah(58000))
    expect(rows[0].hargaMax).toBe(rupiah(65000))
  })
})

describe('filterStokRows', () => {
  const rows = toStokRows([
    barang({ barangId: 'a', nama: 'Semen Tiga Roda', kategori: 'Semen', ukuran: [ukuran({ id: 'a1', ukuran: '50 kg', barcode: '111222', status: 'aman' })] }),
    barang({ barangId: 'b', nama: 'Cat Tembok Putih', kategori: 'Cat', ukuran: [ukuran({ id: 'b1', ukuran: '5 kg', barcode: '333444', status: 'habis', quantity: 0 })] }),
    barang({ barangId: 'c', nama: 'Semen Putih', kategori: 'Semen', ukuran: [ukuran({ id: 'c1', ukuran: '40 kg', status: 'menipis' })] }),
  ])

  const namesOf = (result: ReturnType<typeof filterStokRows>) => result.map(r => r.nama)

  it('matches by a nama substring, case-insensitively', () => {
    expect(namesOf(filterStokRows(rows, { ...EMPTY_STOK_FILTERS, search: 'putih' }))).toEqual(['Cat Tembok Putih', 'Semen Putih'])
  })

  it('matches by an ukuran text substring, not just nama', () => {
    // '40' is a substring of row c's ukuran ('40 kg') but of no nama or
    // barcode in this fixture, so a match here can only come from searching
    // ukuran text - proving that capability specifically.
    expect(namesOf(filterStokRows(rows, { ...EMPTY_STOK_FILTERS, search: '40' }))).toEqual(['Semen Putih'])
  })

  it('matches by a barcode substring, and does not throw for a row with no barcode at all', () => {
    const filters: StokFilterState = { ...EMPTY_STOK_FILTERS, search: '3334' }
    expect(() => filterStokRows(rows, filters)).not.toThrow()
    expect(namesOf(filterStokRows(rows, filters))).toEqual(['Cat Tembok Putih'])
  })

  it('narrows by status', () => {
    expect(namesOf(filterStokRows(rows, { ...EMPTY_STOK_FILTERS, status: 'habis' }))).toEqual(['Cat Tembok Putih'])
  })

  it('narrows by kategori', () => {
    expect(namesOf(filterStokRows(rows, { ...EMPTY_STOK_FILTERS, kategori: 'Cat' }))).toEqual(['Cat Tembok Putih'])
  })
})

describe('summarizeStokRows', () => {
  it('counts total barang and how many are menipis or habis', () => {
    const rows = toStokRows([
      barang({ barangId: 'a', nama: 'A', ukuran: [ukuran({ id: 'a1', ukuran: '1', status: 'aman' })] }),
      barang({ barangId: 'b', nama: 'B', ukuran: [ukuran({ id: 'b1', ukuran: '1', status: 'menipis' })] }),
      barang({ barangId: 'c', nama: 'C', ukuran: [ukuran({ id: 'c1', ukuran: '1', status: 'habis' })] }),
    ])
    expect(summarizeStokRows(rows)).toEqual({ totalBarang: 3, menipisCount: 1, habisCount: 1 })
  })
})
