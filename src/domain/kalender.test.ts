import { describe, it, expect } from 'vitest'
import {
  NAMA_HARI, adalahKey, awalBulan, awalPekan, akhirPekan, batasi, bulanDari, geserBulan, geserBulanKey, geserHari,
  kisiBulan, namaBulan, namaLengkap, ringkas,
} from './kalender'

describe('names', () => {
  it('uses Indonesian month and day names, Monday first', () => {
    expect(NAMA_HARI).toEqual(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'])
    expect(namaBulan({ tahun: 2026, bulan: 9 })).toBe('Oktober 2026')
    expect(namaLengkap('2026-10-04')).toBe('4 Oktober 2026')
    expect(ringkas('2026-10-04')).toBe('4 Okt 2026')
  })

  it('reads the month out of a day key', () => {
    expect(bulanDari('2026-10-04')).toEqual({ tahun: 2026, bulan: 9 })
    expect(awalBulan({ tahun: 2026, bulan: 9 })).toBe('2026-10-01')
    expect(awalBulan({ tahun: 2027, bulan: 0 })).toBe('2027-01-01')
  })
})

describe('shifting', () => {
  it('moves a month across a year end in both directions', () => {
    expect(geserBulan({ tahun: 2026, bulan: 11 }, 1)).toEqual({ tahun: 2027, bulan: 0 })
    expect(geserBulan({ tahun: 2026, bulan: 0 }, -1)).toEqual({ tahun: 2025, bulan: 11 })
    expect(geserBulan({ tahun: 2026, bulan: 5 }, 12)).toEqual({ tahun: 2027, bulan: 5 })
  })

  it('moves a day across month and year ends', () => {
    expect(geserHari('2026-12-31', 1)).toBe('2027-01-01')
    expect(geserHari('2026-01-01', -1)).toBe('2025-12-31')
    expect(geserHari('2028-02-28', 1)).toBe('2028-02-29')
    expect(geserHari('2026-10-04', 7)).toBe('2026-10-11')
  })

  it('moves by months keeping the day, clamped to the target month length', () => {
    expect(geserBulanKey('2026-01-31', 1)).toBe('2026-02-28')
    expect(geserBulanKey('2028-01-31', 1)).toBe('2028-02-29')
    expect(geserBulanKey('2026-03-31', -1)).toBe('2026-02-28')
    expect(geserBulanKey('2026-12-15', 2)).toBe('2027-02-15')
    expect(geserBulanKey('2026-10-18', 12)).toBe('2027-10-18')
  })

  it('finds the Monday and Sunday of a week (2026-10-04 is a Sunday)', () => {
    expect(awalPekan('2026-10-04')).toBe('2026-09-28')
    expect(akhirPekan('2026-10-04')).toBe('2026-10-04')
    expect(awalPekan('2026-10-07')).toBe('2026-10-05')
    expect(akhirPekan('2026-10-07')).toBe('2026-10-11')
  })
})

describe('batasi', () => {
  it('keeps a day inside [min, max]', () => {
    expect(batasi('2026-10-04')).toBe('2026-10-04')
    expect(batasi('2026-10-04', '2026-10-10')).toBe('2026-10-10')
    expect(batasi('2026-10-20', undefined, '2026-10-10')).toBe('2026-10-10')
    expect(batasi('2026-10-05', '2026-10-01', '2026-10-10')).toBe('2026-10-05')
  })
})

describe('kisiBulan', () => {
  it('is always six weeks of seven days', () => {
    const kisi = kisiBulan({ tahun: 2026, bulan: 9 })
    expect(kisi).toHaveLength(6)
    expect(kisi.every(minggu => minggu.length === 7)).toBe(true)
  })

  it('October 2026 (starts on a Thursday) opens with three days of September and ends on 8 November', () => {
    const sel = kisiBulan({ tahun: 2026, bulan: 9 }).flat()
    expect(sel[0]).toEqual({ key: '2026-09-28', dalamBulan: false })
    expect(sel[3]).toEqual({ key: '2026-10-01', dalamBulan: true })
    expect(sel[33]).toEqual({ key: '2026-10-31', dalamBulan: true })
    expect(sel[41]).toEqual({ key: '2026-11-08', dalamBulan: false })
  })

  it('a month starting on Monday (June 2026) has no leading days', () => {
    const sel = kisiBulan({ tahun: 2026, bulan: 5 }).flat()
    expect(sel[0]).toEqual({ key: '2026-06-01', dalamBulan: true })
  })

  it('a month starting on Sunday (February 2026) has six leading days', () => {
    const sel = kisiBulan({ tahun: 2026, bulan: 1 }).flat()
    expect(sel[0]).toEqual({ key: '2026-01-26', dalamBulan: false })
    expect(sel[6]).toEqual({ key: '2026-02-01', dalamBulan: true })
  })

  it('includes 29 February in a leap year and not in a common year', () => {
    const kabisat = kisiBulan({ tahun: 2028, bulan: 1 }).flat().filter(s => s.dalamBulan)
    expect(kabisat).toHaveLength(29)
    expect(kabisat[28].key).toBe('2028-02-29')
    expect(kisiBulan({ tahun: 2027, bulan: 1 }).flat().filter(s => s.dalamBulan)).toHaveLength(28)
  })

  it('wraps a December grid into January of the next year', () => {
    const sel = kisiBulan({ tahun: 2026, bulan: 11 }).flat()
    expect(sel.some(s => s.key === '2027-01-01' && !s.dalamBulan)).toBe(true)
  })

  it('every day appears exactly once, in order', () => {
    const keys = kisiBulan({ tahun: 2026, bulan: 9 }).flat().map(s => s.key)
    expect(new Set(keys).size).toBe(42)
    expect([...keys].sort()).toEqual(keys)
  })
})

describe('adalahKey', () => {
  it('accepts a real yyyy-mm-dd day', () => {
    expect(adalahKey('2026-10-04')).toBe(true)
    expect(adalahKey('2028-02-29')).toBe(true)
  })

  it('rejects nothing, blanks, wrong shapes and days that do not exist', () => {
    for (const salah of [null, undefined, '', 'NaN-NaN-NaN', '2026-1-4', '04-10-2026', '2026-02-30', '2027-02-29', '2026-13-01', '2026-00-10', '2026-10-32']) {
      expect(adalahKey(salah as string | null | undefined), String(salah)).toBe(false)
    }
  })
})
