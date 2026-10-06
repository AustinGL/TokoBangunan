import { describe, it, expect } from 'vitest'
import { hitungPiutang, notaBelumLunas, alokasiTerlama, sisaNota, tanggalBayarTerendah, PELANGGAN_TIDAK_DIKENAL } from './piutang'
import type { Sale } from './projections/sales'
import type { Payment } from './projections/payments'
import type { Customer } from './projections/customers'

const HARI_INI = '2026-10-03'

const bon = (over: Partial<Sale> & Pick<Sale, 'id'>): Sale => ({
  lines: [], metodeBayar: 'bon', subtotal: 100_000, diskon: 0, total: 100_000, deliveryIntent: 'dibawa',
  occurredAt: '2026-09-20T03:00:00.000Z', recordedAt: '2026-09-20T03:00:00.000Z', deviceId: 'd1',
  status: 'aktif', itemIds: [], batchIds: [], customerId: 'c1', jatuhTempo: '2026-10-20', ...over,
})
const bayar = (over: Partial<Payment> & Pick<Payment, 'id' | 'saleId' | 'jumlah'>): Payment => ({
  occurredAt: '2026-09-25T03:00:00.000Z', recordedAt: '2026-09-25T03:00:00.000Z', deviceId: 'd1', ...over,
})
const cust = (id: string, nama: string, telepon?: string): Customer => ({
  id, nama, telepon, tier: 'eceran', termynHari: 30, updatedAt: 't', updatedByEventId: 'e',
})

describe('sisaNota', () => {
  it('is total minus the down payment minus every payment', () => {
    expect(sisaNota({ total: 100_000, dibayarAwal: 20_000 }, [{ jumlah: 30_000 }, { jumlah: 10_000 }])).toBe(40_000)
  })
  it('treats a missing down payment as zero', () => {
    expect(sisaNota({ total: 100_000 }, [])).toBe(100_000)
  })
  it('never goes below zero when payments exceed the total (two devices paid before syncing)', () => {
    expect(sisaNota({ total: 100_000 }, [{ jumlah: 80_000 }, { jumlah: 80_000 }])).toBe(0)
  })
})

describe('hitungPiutang', () => {
  it('is empty with no Bon sales', () => {
    expect(hitungPiutang([], [], [], HARI_INI)).toEqual({ totalSisa: 0, jumlahPelanggan: 0, jumlahLewatTempo: 0, pelanggan: [] })
  })

  it('ignores tunai sales', () => {
    const tunai = bon({ id: 's1', metodeBayar: 'tunai', jatuhTempo: undefined, customerId: undefined })
    expect(hitungPiutang([tunai], [], [], HARI_INI).pelanggan).toEqual([])
  })

  it('derives sisa from the down payment and payments, with the nota fields', () => {
    const s = bon({ id: 's1', total: 100_000, dibayarAwal: 20_000, jatuhTempo: '2026-10-20' })
    const r = hitungPiutang([s], [bayar({ id: 'p1', saleId: 's1', jumlah: 30_000 })], [cust('c1', 'Budi', '0812')], HARI_INI)
    expect(r.totalSisa).toBe(50_000)
    expect(r.jumlahPelanggan).toBe(1)
    const p = r.pelanggan[0]
    expect(p).toMatchObject({ customerId: 'c1', nama: 'Budi', telepon: '0812', totalSisa: 50_000, jumlahNota: 1 })
    expect(p.nota[0]).toMatchObject({ saleId: 's1', total: 100_000, dibayar: 50_000, sisa: 50_000, jatuhTempo: '2026-10-20' })
  })

  it('leaves a fully paid (lunas) nota out, and the customer with it', () => {
    const s = bon({ id: 's1', total: 100_000 })
    const r = hitungPiutang([s], [bayar({ id: 'p1', saleId: 's1', jumlah: 100_000 })], [cust('c1', 'Budi')], HARI_INI)
    expect(r.pelanggan).toEqual([])
    expect(r.totalSisa).toBe(0)
  })

  it('excludes a voided Bon sale', () => {
    const r = hitungPiutang([bon({ id: 's1', status: 'batal' })], [], [cust('c1', 'Budi')], HARI_INI)
    expect(r.pelanggan).toEqual([])
  })

  it('status boundaries: yesterday is lewat, today and today+3 are segera, today+4 is berjalan', () => {
    const s = (id: string, jatuhTempo: string) => bon({ id, customerId: id, jatuhTempo })
    const r = hitungPiutang(
      [s('c-kemarin', '2026-10-02'), s('c-hari-ini', '2026-10-03'), s('c-plus3', '2026-10-06'), s('c-plus4', '2026-10-07')],
      [], [], HARI_INI,
    )
    const by = (id: string) => r.pelanggan.find(p => p.customerId === id)!
    expect(by('c-kemarin')).toMatchObject({ status: 'lewat', hariLewat: 1, hariLagi: 0 })
    expect(by('c-hari-ini')).toMatchObject({ status: 'segera', hariLagi: 0, hariLewat: 0 })
    expect(by('c-plus3')).toMatchObject({ status: 'segera', hariLagi: 3 })
    expect(by('c-plus4')).toMatchObject({ status: 'berjalan', hariLagi: 4 })
  })

  it('counts days across a month end in local days', () => {
    const s = bon({ id: 's1', jatuhTempo: '2026-11-02' })
    const r = hitungPiutang([s], [], [], '2026-10-31')
    expect(r.pelanggan[0]).toMatchObject({ status: 'segera', hariLagi: 2 })
  })

  it('a customer takes the status of its most overdue nota, and lists notas oldest due first', () => {
    const r = hitungPiutang([
      bon({ id: 'baru', jatuhTempo: '2026-10-25' }),
      bon({ id: 'lama', jatuhTempo: '2026-09-28' }),
    ], [], [cust('c1', 'Budi')], HARI_INI)
    const p = r.pelanggan[0]
    expect(p.status).toBe('lewat')
    expect(p.hariLewat).toBe(5)
    expect(p.jatuhTempoTerdekat).toBe('2026-09-28')
    expect(p.nota.map(n => n.saleId)).toEqual(['lama', 'baru'])
    expect(p.jumlahNota).toBe(2)
    expect(p.totalSisa).toBe(200_000)
  })

  it('orders customers: lewat, then segera, then berjalan; ties by due date, then by larger sisa', () => {
    const mk = (id: string, jatuhTempo: string, total: number) => bon({ id, customerId: id, jatuhTempo, total, subtotal: total })
    const r = hitungPiutang([
      mk('berjalan-kecil', '2026-11-30', 10_000), mk('berjalan-besar', '2026-11-30', 90_000),
      mk('segera', '2026-10-05', 50_000),
      mk('lewat-baru', '2026-10-01', 500_000), mk('lewat-lama', '2026-09-01', 5_000),
    ], [], [], HARI_INI)
    expect(r.pelanggan.map(p => p.customerId)).toEqual(['lewat-lama', 'lewat-baru', 'segera', 'berjalan-besar', 'berjalan-kecil'])
    expect(r.jumlahLewatTempo).toBe(2)
  })

  it('shows "Pelanggan tidak dikenal" for a customerId with no customer row, and still counts it', () => {
    const r = hitungPiutang([bon({ id: 's1', customerId: 'belum-sinkron' })], [], [], HARI_INI)
    expect(r.pelanggan[0]).toMatchObject({ customerId: 'belum-sinkron', nama: PELANGGAN_TIDAK_DIKENAL, totalSisa: 100_000 })
    expect(r.totalSisa).toBe(100_000)
  })

  it('lists a customer\'s payments newest first, including those on notas now lunas', () => {
    const lunas = bon({ id: 'lunas', total: 40_000, subtotal: 40_000 })
    const buka = bon({ id: 'buka', total: 100_000 })
    const r = hitungPiutang([lunas, buka], [
      bayar({ id: 'p1', saleId: 'lunas', jumlah: 40_000, occurredAt: '2026-09-26T03:00:00.000Z' }),
      bayar({ id: 'p2', saleId: 'buka', jumlah: 10_000, occurredAt: '2026-09-28T03:00:00.000Z', catatan: 'cicilan' }),
    ], [cust('c1', 'Budi')], HARI_INI)
    expect(r.pelanggan[0].pembayaran.map(p => p.id)).toEqual(['p2', 'p1'])
    expect(r.pelanggan[0].pembayaran[0]).toMatchObject({ saleId: 'buka', jumlah: 10_000, catatan: 'cicilan' })
  })

  it('totals across customers', () => {
    const r = hitungPiutang([bon({ id: 'a', customerId: 'c1' }), bon({ id: 'b', customerId: 'c2', total: 60_000, subtotal: 60_000 })], [], [], HARI_INI)
    expect(r).toMatchObject({ totalSisa: 160_000, jumlahPelanggan: 2 })
  })
})

describe('notaBelumLunas', () => {
  it('returns one customer\'s unpaid active Bon notas, oldest due first, ties by occurredAt', () => {
    const sales = [
      bon({ id: 'b', jatuhTempo: '2026-10-10', occurredAt: '2026-09-22T03:00:00.000Z' }),
      bon({ id: 'a', jatuhTempo: '2026-10-10', occurredAt: '2026-09-21T03:00:00.000Z' }),
      bon({ id: 'c', jatuhTempo: '2026-10-01' }),
      bon({ id: 'other', customerId: 'c2' }),
      bon({ id: 'void', status: 'batal' }),
      bon({ id: 'lunas', total: 10_000, subtotal: 10_000 }),
    ]
    const payments = [bayar({ id: 'p', saleId: 'lunas', jumlah: 10_000 })]
    expect(notaBelumLunas(sales, payments, 'c1').map(n => n.saleId)).toEqual(['c', 'a', 'b'])
  })
})

describe('alokasiTerlama', () => {
  const nota = (saleId: string, sisa: number, jatuhTempo: string, occurredAt = '2026-09-20T03:00:00.000Z') => ({ saleId, sisa, jatuhTempo, occurredAt })

  it('pays one nota when the amount fits inside the oldest', () => {
    expect(alokasiTerlama([nota('a', 100, '2026-10-01'), nota('b', 100, '2026-10-02')], 40)).toEqual([{ saleId: 'a', jumlah: 40 }])
  })

  it('spills over into the next nota, oldest due first, whatever order it is given', () => {
    expect(alokasiTerlama([nota('b', 100, '2026-10-02'), nota('a', 70, '2026-10-01')], 120)).toEqual([
      { saleId: 'a', jumlah: 70 }, { saleId: 'b', jumlah: 50 },
    ])
  })

  it('settles every nota exactly when the amount equals the total', () => {
    expect(alokasiTerlama([nota('a', 70, '2026-10-01'), nota('b', 30, '2026-10-02')], 100)).toEqual([
      { saleId: 'a', jumlah: 70 }, { saleId: 'b', jumlah: 30 },
    ])
  })

  it('breaks a due-date tie by occurredAt', () => {
    expect(alokasiTerlama([
      nota('baru', 50, '2026-10-01', '2026-09-22T03:00:00.000Z'), nota('lama', 50, '2026-10-01', '2026-09-21T03:00:00.000Z'),
    ], 30)).toEqual([{ saleId: 'lama', jumlah: 30 }])
  })

  it('rejects zero, negative, fractional and over-total amounts without allocating anything', () => {
    const n = [nota('a', 100, '2026-10-01')]
    expect(() => alokasiTerlama(n, 0)).toThrow('Jumlah harus lebih dari 0.')
    expect(() => alokasiTerlama(n, -5)).toThrow('Jumlah harus lebih dari 0.')
    expect(() => alokasiTerlama(n, 10.5)).toThrow('Jumlah harus lebih dari 0.')
    expect(() => alokasiTerlama(n, 101)).toThrow('Jumlah melebihi total piutang.')
  })

describe('hitungPiutang: the overdue and due-soon parts', () => {
  it('splits a customer total into the part lewat tempo, the part segera and the rest', () => {
    const r = hitungPiutang([
      bon({ id: 'telat', total: 200_000, subtotal: 200_000, jatuhTempo: '2026-10-01' }),
      bon({ id: 'dekat', total: 150_000, subtotal: 150_000, jatuhTempo: '2026-10-05' }),
      bon({ id: 'jauh', total: 3_000_000, subtotal: 3_000_000, jatuhTempo: '2026-10-28' }),
    ], [], [cust('c1', 'Budi')], HARI_INI)
    expect(r.pelanggan[0]).toMatchObject({ totalSisa: 3_350_000, sisaLewat: 200_000, sisaSegera: 150_000, status: 'lewat' })
  })

  it('counts what is still owed, after payments, in each part', () => {
    const r = hitungPiutang(
      [bon({ id: 'telat', total: 200_000, subtotal: 200_000, jatuhTempo: '2026-10-01', dibayarAwal: 50_000 })],
      [bayar({ id: 'p1', saleId: 'telat', jumlah: 30_000 })], [cust('c1', 'Budi')], HARI_INI,
    )
    expect(r.pelanggan[0]).toMatchObject({ totalSisa: 120_000, sisaLewat: 120_000, sisaSegera: 0 })
  })

  it('a customer who is only berjalan has no overdue or due-soon part', () => {
    const r = hitungPiutang([bon({ id: 'jauh', jatuhTempo: '2026-11-30' })], [], [], HARI_INI)
    expect(r.pelanggan[0]).toMatchObject({ sisaLewat: 0, sisaSegera: 0 })
  })
})
})

describe('tanggalBayarTerendah', () => {
  it('is the latest local day among the notas a payment touches: nothing can be paid before it exists', () => {
    expect(tanggalBayarTerendah([
      { occurredAt: new Date(2026, 9, 1, 12).toISOString() },
      { occurredAt: new Date(2026, 9, 8, 12).toISOString() },
      { occurredAt: new Date(2026, 9, 3, 12).toISOString() },
    ])).toBe('2026-10-08')
  })

  it('reads a late-evening nota as its local day, not the UTC day', () => {
    expect(tanggalBayarTerendah([{ occurredAt: new Date(2026, 9, 8, 23, 30).toISOString() }])).toBe('2026-10-08')
  })

  it('is undefined for no notas', () => {
    expect(tanggalBayarTerendah([])).toBeUndefined()
  })
})
