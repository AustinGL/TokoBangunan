import { describe, it, expect } from 'vitest'
import { daftarPelanggan, cariPelanggan, riwayatBon, kelebihanBayar } from './pelanggan'
import { hitungPiutang } from './piutang'
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

describe('daftarPelanggan', () => {
  it('lists every customer by name, including ones who owe nothing', () => {
    const customers = [cust('c2', 'sari'), cust('c1', 'Budi'), cust('c3', 'Agus')]
    const ringkasan = hitungPiutang([bon({ id: 's1', customerId: 'c1', total: 300_000 })], [], customers, HARI_INI)
    const rows = daftarPelanggan(customers, ringkasan)
    expect(rows.map(r => r.nama)).toEqual(['Agus', 'Budi', 'sari'])
    expect(rows.find(r => r.id === 'c1')).toMatchObject({ totalSisa: 300_000, jumlahNota: 1 })
    expect(rows.find(r => r.id === 'c3')).toMatchObject({ totalSisa: 0, jumlahNota: 0 })
  })

  it('shows a fully paid customer as owing nothing', () => {
    const customers = [cust('c1', 'Budi')]
    const sales = [bon({ id: 's1', total: 100_000 })]
    const ringkasan = hitungPiutang(sales, [bayar({ id: 'p1', saleId: 's1', jumlah: 100_000 })], customers, HARI_INI)
    expect(daftarPelanggan(customers, ringkasan)[0]).toMatchObject({ totalSisa: 0, jumlahNota: 0 })
  })

  it('carries phone and the overdue status of one who owes', () => {
    const customers = [cust('c1', 'Budi', '0812')]
    const ringkasan = hitungPiutang([bon({ id: 's1', jatuhTempo: '2026-09-30' })], [], customers, HARI_INI)
    expect(daftarPelanggan(customers, ringkasan)[0]).toMatchObject({ telepon: '0812', status: 'lewat' })
  })

  it('is empty for no customers', () => {
    expect(daftarPelanggan([], hitungPiutang([], [], [], HARI_INI))).toEqual([])
  })
})

describe('cariPelanggan', () => {
  const rows = daftarPelanggan(
    [cust('c1', 'Budi Santoso', '0812-555-0101'), cust('c2', 'Sari', '+62 813 555 0202'), cust('c3', 'Agus')],
    hitungPiutang([], [], [], HARI_INI),
  )
  it('returns everyone for a blank query', () => {
    expect(cariPelanggan(rows, '  ')).toHaveLength(3)
  })
  it('matches a name part, ignoring case', () => {
    expect(cariPelanggan(rows, 'santo').map(r => r.id)).toEqual(['c1'])
  })
  it('matches a phone number however it was typed', () => {
    expect(cariPelanggan(rows, '0813').map(r => r.id)).toEqual([])
    expect(cariPelanggan(rows, '813 555').map(r => r.id)).toEqual(['c2'])
    expect(cariPelanggan(rows, '0812555').map(r => r.id)).toEqual(['c1'])
  })
  it('does not match every customer without a phone when the query has no digits', () => {
    expect(cariPelanggan(rows, 'zzz')).toEqual([])
  })
})

describe('riwayatBon', () => {
  it('keeps paid-off notas, newest first, with what was paid and what is left', () => {
    const sales = [
      bon({ id: 'lama', occurredAt: '2026-08-01T03:00:00.000Z', total: 100_000, dibayarAwal: 20_000 }),
      bon({ id: 'baru', occurredAt: '2026-09-20T03:00:00.000Z', total: 200_000 }),
    ]
    const payments = [bayar({ id: 'p1', saleId: 'lama', jumlah: 80_000 }), bayar({ id: 'p2', saleId: 'baru', jumlah: 50_000 })]
    const { nota } = riwayatBon(sales, payments, 'c1')
    expect(nota.map(n => n.saleId)).toEqual(['baru', 'lama'])
    expect(nota[0]).toMatchObject({ total: 200_000, dibayar: 50_000, sisa: 150_000 })
    expect(nota[1]).toMatchObject({ total: 100_000, dibayar: 100_000, sisa: 0 })
  })

  it('leaves out other customers, voided notas and cash sales', () => {
    const sales = [
      bon({ id: 'a' }),
      bon({ id: 'lain', customerId: 'c2' }),
      bon({ id: 'batal', status: 'batal' }),
      bon({ id: 'tunai', metodeBayar: 'tunai', customerId: undefined, jatuhTempo: undefined }),
    ]
    expect(riwayatBon(sales, [], 'c1').nota.map(n => n.saleId)).toEqual(['a'])
  })

  it('lists payments on this customer’s notas only, newest first', () => {
    const sales = [bon({ id: 'a' }), bon({ id: 'lain', customerId: 'c2' })]
    const payments = [
      bayar({ id: 'p1', saleId: 'a', jumlah: 10_000, occurredAt: '2026-09-21T03:00:00.000Z' }),
      bayar({ id: 'p2', saleId: 'a', jumlah: 20_000, occurredAt: '2026-09-25T03:00:00.000Z' }),
      bayar({ id: 'p3', saleId: 'lain', jumlah: 30_000 }),
    ]
    expect(riwayatBon(sales, payments, 'c1').pembayaran.map(p => p.id)).toEqual(['p2', 'p1'])
  })

  it('is empty for a customer who never took Bon', () => {
    expect(riwayatBon([bon({ id: 'a' })], [], 'c9')).toEqual({ nota: [], pembayaran: [] })
  })
})

describe('kelebihan bayar (two devices recorded the same payment before syncing)', () => {
  const sales = [bon({ id: 'a', total: 100_000 }), bon({ id: 'b', total: 50_000, customerId: 'c2' })]

  it('is what was paid beyond the total of a nota, per customer', () => {
    const payments = [
      bayar({ id: 'p1', saleId: 'a', jumlah: 100_000 }),
      bayar({ id: 'p2', saleId: 'a', jumlah: 100_000 }), // the same payment, recorded again on the other device
      bayar({ id: 'p3', saleId: 'b', jumlah: 50_000 }),
    ]
    expect(kelebihanBayar(sales, payments)).toEqual({ c1: 100_000 })
  })

  it('counts a down payment toward the total, and adds up several notas of one customer', () => {
    const s = [bon({ id: 'a', total: 100_000, dibayarAwal: 40_000 }), bon({ id: 'c', total: 10_000 })]
    const payments = [bayar({ id: 'p1', saleId: 'a', jumlah: 70_000 }), bayar({ id: 'p2', saleId: 'c', jumlah: 15_000 })]
    expect(kelebihanBayar(s, payments)).toEqual({ c1: 10_000 + 5_000 })
  })

  it('is empty when nothing is overpaid, and ignores voided notas', () => {
    expect(kelebihanBayar(sales, [bayar({ id: 'p1', saleId: 'a', jumlah: 100_000 })])).toEqual({})
    const voided = [bon({ id: 'a', total: 100_000, status: 'batal' })]
    expect(kelebihanBayar(voided, [bayar({ id: 'p1', saleId: 'a', jumlah: 150_000 })])).toEqual({})
  })

  it('shows on the nota history and on the customer row', () => {
    const payments = [bayar({ id: 'p1', saleId: 'a', jumlah: 100_000 }), bayar({ id: 'p2', saleId: 'a', jumlah: 30_000 })]
    expect(riwayatBon(sales, payments, 'c1').nota[0]).toMatchObject({ dibayar: 100_000, sisa: 0, lebih: 30_000 })
    const customers = [cust('c1', 'Budi'), cust('c2', 'Sari')]
    const rows = daftarPelanggan(customers, hitungPiutang(sales, payments, customers, HARI_INI), kelebihanBayar(sales, payments))
    expect(rows.find(r => r.id === 'c1')).toMatchObject({ kelebihan: 30_000 })
    expect(rows.find(r => r.id === 'c2')).toMatchObject({ kelebihan: 0 })
  })
})
