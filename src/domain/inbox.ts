import { formatRupiah, rupiah } from './money'
import { HARI_SEGERA, type PiutangStatus } from './piutang'

/**
 * Beranda's "Perlu diurus" rules. Lives in domain/ (not in the component)
 * because what earns a row, when rows group, and where each one links are
 * business rules with real consequences (flow spec section 5), and they need
 * plain-function tests.
 *
 * Stock rows and piutang rows (lewat tempo, jatuh tempo within HARI_SEGERA
 * days) exist so far. Pengiriman belum jalan and transaksi draft join when
 * those flows are built.
 */

export type InboxUkuranInput = {
  id: string
  /** The ukuran's own unit label, e.g. "sak". */
  ukuran: string
  diarsipkan: boolean
  status: 'habis' | 'menipis' | 'aman'
}

export type InboxBarangInput = {
  barangId: string
  nama: string
  diarsipkan: boolean
  /** A legacy item with no real barang record: cannot be prefilled into Tambah stok's barang picker. */
  virtual: boolean
  ukuran: InboxUkuranInput[]
}

/** What a customer's piutang says to the inbox: PelangganPiutang already has all of it. */
export type InboxPiutangInput = {
  customerId: string
  nama: string
  totalSisa: number
  /** The part of totalSisa that is past due, and the part due within HARI_SEGERA days. */
  sisaLewat: number
  sisaSegera: number
  status: PiutangStatus
  hariLewat: number
  hariLagi: number
}

export type InboxItem = { key: string; label: string; to: string }

export type InboxRow = {
  key: string
  severity: 'danger' | 'warning'
  title: string
  /** The words of the link: "Tambah stok", "Lihat piutang". */
  aksi: string
  /** More than one item means the row is grouped and expands to list them. */
  items: InboxItem[]
}

/** Up to this many entries of one kind stay individual rows; this many or more collapse into one expandable row. */
export const GROUP_THRESHOLD = 3

/**
 * The Tambah stok link for one ukuran, with the barang and ukuran
 * prefilled (Stok reads these params) so the owner lands on the fix, not on
 * a list to search through. A virtual barang cannot be prefilled, so it
 * opens the empty sheet.
 */
export function restockLink(barang: Pick<InboxBarangInput, 'barangId' | 'virtual'>, ukuranId: string): string {
  if (barang.virtual) return '/stok?tambah=1'
  return `/stok?tambah=1&barang=${encodeURIComponent(barang.barangId)}&ukuran=${encodeURIComponent(ukuranId)}`
}

const rp = (n: number): string => formatRupiah(rupiah(n))

const piutangLink = (customerId: string): string => `/piutang/${encodeURIComponent(customerId)}`

const hariLagiText = (hariLagi: number): string => (hariLagi === 0 ? 'hari ini' : `${hariLagi} hari lagi`)

/**
 * Danger rows (stok habis, piutang lewat tempo) come before warning rows
 * (stok menipis, piutang segera), stock before piutang inside each, so an
 * overdue customer is never buried under a low-stock warning. A customer
 * who is only berjalan earns no row: it does not cost anything yet.
 */
export function buildInbox(barang: InboxBarangInput[], piutang: InboxPiutangInput[] = []): InboxRow[] {
  const habis: InboxItem[] = []
  const menipis: InboxItem[] = []

  const sorted = [...barang].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  for (const b of sorted) {
    if (b.diarsipkan) continue
    const multipleUkuran = b.ukuran.filter(u => !u.diarsipkan).length > 1
    for (const u of b.ukuran) {
      if (u.diarsipkan || u.status === 'aman') continue
      const item: InboxItem = {
        key: u.id,
        label: multipleUkuran ? `${b.nama} (${u.ukuran})` : b.nama,
        to: restockLink(b, u.id),
      }
      if (u.status === 'habis') habis.push(item)
      else menipis.push(item)
    }
  }

  const lewat = piutang.filter(p => p.status === 'lewat')
  const segera = piutang.filter(p => p.status === 'segera')

  return [
    ...toRows('habis', 'danger', habis, 'Tambah stok', item => `${item.label} habis`, n => `${n} barang habis`),
    ...piutangRows(
      'lewat', 'danger', lewat,
      p => `${p.nama} lewat tempo ${p.hariLewat} hari (${rp(p.sisaLewat)})`,
      p => `${p.nama} · ${rp(p.sisaLewat)} · lewat ${p.hariLewat} hari`,
      n => `${n} pelanggan lewat tempo`,
    ),
    ...toRows('menipis', 'warning', menipis, 'Tambah stok', item => `${item.label} menipis`, n => `${n} barang menipis`),
    ...piutangRows(
      'segera', 'warning', segera,
      p => `${p.nama} jatuh tempo ${hariLagiText(p.hariLagi)} (${rp(p.sisaSegera)})`,
      p => `${p.nama} · ${rp(p.sisaSegera)} · ${hariLagiText(p.hariLagi)}`,
      n => `${n} pelanggan jatuh tempo dalam ${HARI_SEGERA} hari`,
    ),
  ]
}

function piutangRows(
  kind: string,
  severity: InboxRow['severity'],
  pelanggan: InboxPiutangInput[],
  single: (p: InboxPiutangInput) => string,
  groupedLabel: (p: InboxPiutangInput) => string,
  grouped: (count: number) => string,
): InboxRow[] {
  if (pelanggan.length === 0) return []
  const aksi = 'Lihat piutang'
  if (pelanggan.length >= GROUP_THRESHOLD) {
    return [{
      key: `${kind}-group`, severity, title: grouped(pelanggan.length), aksi,
      items: pelanggan.map(p => ({ key: p.customerId, label: groupedLabel(p), to: piutangLink(p.customerId) })),
    }]
  }
  return pelanggan.map(p => ({
    key: `${kind}-${p.customerId}`, severity, title: single(p), aksi,
    items: [{ key: p.customerId, label: p.nama, to: piutangLink(p.customerId) }],
  }))
}

function toRows(
  kind: string,
  severity: InboxRow['severity'],
  items: InboxItem[],
  aksi: string,
  single: (item: InboxItem) => string,
  grouped: (count: number) => string,
): InboxRow[] {
  if (items.length === 0) return []
  if (items.length >= GROUP_THRESHOLD) {
    return [{ key: `${kind}-group`, severity, title: grouped(items.length), aksi, items }]
  }
  return items.map(item => ({ key: `${kind}-${item.key}`, severity, title: single(item), aksi, items: [item] }))
}
