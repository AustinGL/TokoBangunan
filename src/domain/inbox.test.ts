import { describe, it, expect } from 'vitest'
import { buildInbox, restockLink, GROUP_THRESHOLD, type InboxBarangInput } from './inbox'

const barang = (
  id: string, nama: string, ukuran: Array<[string, 'habis' | 'menipis' | 'aman']>,
  extra: Partial<InboxBarangInput> = {},
): InboxBarangInput => ({
  barangId: id, nama, diarsipkan: false, virtual: false,
  ukuran: ukuran.map(([label, status], i) => ({ id: `${id}-${i}`, ukuran: label, diarsipkan: false, status })),
  ...extra,
})

describe('buildInbox', () => {
  it('is empty when everything is aman', () => {
    expect(buildInbox([barang('b1', 'Semen', [['sak', 'aman']])])).toEqual([])
  })

  it('makes an individual danger row for a single habis ukuran, linking to a prefilled restock', () => {
    const rows = buildInbox([barang('b1', 'Semen Tiga Roda', [['sak', 'habis']])])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ severity: 'danger', title: 'Semen Tiga Roda habis' })
    expect(rows[0].items[0].to).toBe('/stok?tambah=1&barang=b1&ukuran=b1-0')
  })

  it('lists habis before menipis', () => {
    const rows = buildInbox([
      barang('b1', 'Cat', [['kaleng', 'menipis']]),
      barang('b2', 'Paku', [['kg', 'habis']]),
    ])
    expect(rows.map(r => r.severity)).toEqual(['danger', 'warning'])
  })

  it('names the ukuran when a barang has several', () => {
    const rows = buildInbox([barang('b1', 'Besi', [['6mm', 'habis'], ['8mm', 'aman']])])
    expect(rows[0].title).toBe('Besi (6mm) habis')
  })

  it('groups a kind into one expandable row once it reaches the threshold', () => {
    const many = Array.from({ length: GROUP_THRESHOLD }, (_, i) => barang(`b${i}`, `Barang ${i}`, [['pcs', 'menipis']]))
    const rows = buildInbox(many)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'menipis-group', title: `${GROUP_THRESHOLD} barang menipis` })
    expect(rows[0].items).toHaveLength(GROUP_THRESHOLD)
  })

  it('keeps individual rows below the threshold', () => {
    const few = Array.from({ length: GROUP_THRESHOLD - 1 }, (_, i) => barang(`b${i}`, `Barang ${i}`, [['pcs', 'menipis']]))
    expect(buildInbox(few)).toHaveLength(GROUP_THRESHOLD - 1)
  })

  it('groups habis and menipis independently', () => {
    const rows = buildInbox([
      barang('h1', 'A', [['x', 'habis']]), barang('h2', 'B', [['x', 'habis']]),
      ...Array.from({ length: GROUP_THRESHOLD }, (_, i) => barang(`m${i}`, `M${i}`, [['x', 'menipis']])),
    ])
    expect(rows.filter(r => r.severity === 'danger')).toHaveLength(2)
    expect(rows.filter(r => r.severity === 'warning')).toHaveLength(1)
  })

  it('skips archived barang and archived ukuran', () => {
    const archivedBarang = barang('b1', 'Lama', [['x', 'habis']], { diarsipkan: true })
    const withArchivedUkuran = barang('b2', 'Baru', [['x', 'habis']])
    withArchivedUkuran.ukuran[0].diarsipkan = true
    expect(buildInbox([archivedBarang, withArchivedUkuran])).toEqual([])
  })

  it('sorts by name', () => {
    const rows = buildInbox([barang('b1', 'Zinc', [['x', 'habis']]), barang('b2', 'Aci', [['x', 'habis']])])
    expect(rows.map(r => r.title)).toEqual(['Aci habis', 'Zinc habis'])
  })
})

describe('restockLink', () => {
  it('opens the empty sheet for a virtual barang, which cannot be prefilled', () => {
    expect(restockLink({ barangId: 'item-1', virtual: true }, 'i1')).toBe('/stok?tambah=1')
  })
})

describe('buildInbox: piutang', () => {
  const pelanggan = (
    customerId: string, nama: string, status: 'lewat' | 'segera' | 'berjalan', totalSisa = 450_000,
    extra: Partial<{ hariLewat: number; hariLagi: number; sisaLewat: number; sisaSegera: number }> = {},
  ) => ({
    customerId, nama, status, totalSisa, hariLewat: 0, hariLagi: 0,
    sisaLewat: status === 'lewat' ? totalSisa : 0, sisaSegera: status === 'segera' ? totalSisa : 0, ...extra,
  })

  it('makes a danger row for a customer who is lewat tempo, linking to their page, with the days and the amount', () => {
    const rows = buildInbox([], [pelanggan('c1', 'Budi', 'lewat', 450_000, { hariLewat: 12 })])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ severity: 'danger', title: 'Budi lewat tempo 12 hari (Rp 450.000)', aksi: 'Lihat piutang' })
    expect(rows[0].items).toEqual([{ key: 'c1', label: 'Budi', to: '/piutang/c1' }])
  })

  it('makes a warning row for a customer who is segera, saying hari ini or the days left', () => {
    const rows = buildInbox([], [
      pelanggan('c1', 'Sari', 'segera', 120_000, { hariLagi: 2 }),
      pelanggan('c2', 'Tono', 'segera', 30_000, { hariLagi: 0 }),
    ])
    expect(rows.map(r => r.title)).toEqual([
      'Sari jatuh tempo 2 hari lagi (Rp 120.000)',
      'Tono jatuh tempo hari ini (Rp 30.000)',
    ])
    expect(rows.every(r => r.severity === 'warning')).toBe(true)
  })

  it('gives a customer who is only berjalan no row at all', () => {
    expect(buildInbox([], [pelanggan('c1', 'Budi', 'berjalan')])).toEqual([])
  })

  it('groups lewat customers once they reach the threshold, listing each with amount and days', () => {
    const many = Array.from({ length: GROUP_THRESHOLD }, (_, i) =>
      pelanggan(`c${i}`, `Pelanggan ${i}`, 'lewat', 100_000, { hariLewat: i + 1 }))
    const rows = buildInbox([], many)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'lewat-group', severity: 'danger', title: `${GROUP_THRESHOLD} pelanggan lewat tempo`, aksi: 'Lihat piutang' })
    expect(rows[0].items[0]).toEqual({ key: 'c0', label: 'Pelanggan 0 · Rp 100.000 · lewat 1 hari', to: '/piutang/c0' })
  })

  it('groups segera customers with their own title, and lists hari ini or the days left', () => {
    const many = [
      pelanggan('c0', 'A', 'segera', 10_000, { hariLagi: 0 }),
      pelanggan('c1', 'B', 'segera', 20_000, { hariLagi: 1 }),
      pelanggan('c2', 'C', 'segera', 30_000, { hariLagi: 3 }),
    ]
    const rows = buildInbox([], many)
    expect(rows[0]).toMatchObject({ key: 'segera-group', title: '3 pelanggan jatuh tempo dalam 3 hari' })
    expect(rows[0].items.map(i => i.label)).toEqual(['A · Rp 10.000 · hari ini', 'B · Rp 20.000 · 1 hari lagi', 'C · Rp 30.000 · 3 hari lagi'])
  })

  it('keeps one row per customer below the threshold, in the order given', () => {
    const rows = buildInbox([], [pelanggan('c1', 'A', 'lewat', 1_000, { hariLewat: 9 }), pelanggan('c2', 'B', 'lewat', 2_000, { hariLewat: 1 })])
    expect(rows.map(r => r.key)).toEqual(['lewat-c1', 'lewat-c2'])
  })

  it('orders by danger first: habis and lewat, then menipis and segera, with stock before piutang inside each', () => {
    const rows = buildInbox(
      [barang('b1', 'Cat', [['kaleng', 'menipis']]), barang('b2', 'Paku', [['kg', 'habis']])],
      [pelanggan('c1', 'Budi', 'lewat', 1_000, { hariLewat: 2 }), pelanggan('c2', 'Sari', 'segera', 1_000, { hariLagi: 1 })],
    )
    expect(rows.map(r => r.key)).toEqual(['habis-b2-0', 'lewat-c1', 'menipis-b1-0', 'segera-c2'])
  })

  it('stock rows now carry their own action label', () => {
    expect(buildInbox([barang('b1', 'Semen', [['sak', 'habis']])])[0].aksi).toBe('Tambah stok')
  })

  it('names only the part that is overdue, never the whole balance, when other notas are not yet due', () => {
    const rows = buildInbox([], [pelanggan('c1', 'Budi', 'lewat', 3_200_000, { hariLewat: 2, sisaLewat: 200_000 })])
    expect(rows[0].title).toBe('Budi lewat tempo 2 hari (Rp 200.000)')
  })

  it('names only the part due within three days for a segera customer', () => {
    const rows = buildInbox([], [pelanggan('c1', 'Sari', 'segera', 1_000_000, { hariLagi: 2, sisaSegera: 150_000 })])
    expect(rows[0].title).toBe('Sari jatuh tempo 2 hari lagi (Rp 150.000)')
  })

  it('a grouped row lists each customer with the overdue part only', () => {
    const many = Array.from({ length: GROUP_THRESHOLD }, (_, i) =>
      pelanggan(`c${i}`, `P${i}`, 'lewat', 900_000, { hariLewat: 4, sisaLewat: 100_000 }))
    expect(buildInbox([], many)[0].items[0].label).toBe('P0 · Rp 100.000 · lewat 4 hari')
  })

  it('without a second argument it is exactly the stock-only inbox', () => {
    expect(buildInbox([barang('b1', 'Semen', [['sak', 'habis']])])).toHaveLength(1)
  })
})
