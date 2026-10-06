import { formatRupiah, rupiah } from './money'
import type { PiutangStatus } from './piutang'
import { dateAtLocalNoon } from './tanggal'

/**
 * The WhatsApp payment reminder: the number it goes to, the polite Bahasa
 * message, and the wa.me link. Pure: the hour is passed in, nothing is sent.
 */

/**
 * A phone number as WhatsApp wants it (country code, digits only), or null
 * when it cannot be an Indonesian number. Accepts 0812..., +62 812...,
 * 62812..., 812..., 0062812... and a stray 0 after 62.
 */
export function nomorWhatsApp(telepon: string | undefined): string | null {
  if (!telepon) return null
  let digits = telepon.replace(/\D/g, '').replace(/^00/, '')
  if (digits.startsWith('62')) digits = digits.replace(/^620/, '62')
  else if (digits.startsWith('0')) digits = `62${digits.slice(1)}`
  else if (digits.startsWith('8')) digits = `62${digits}`
  else return null
  return /^62\d{8,13}$/.test(digits) ? digits : null
}

export type DataPengingat = {
  nama: string
  totalSisa: number
  /** The part of totalSisa that is past due (see PelangganPiutang.sisaLewat). */
  sisaLewat: number
  jumlahNota: number
  status: PiutangStatus
  /** yyyy-mm-dd of the nota that is due first. */
  jatuhTempoTerdekat: string
}

const salam = (jam: number): string =>
  jam < 11 ? 'pagi' : jam < 15 ? 'siang' : jam < 18 ? 'sore' : 'malam'

const tanggal = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * With a shop name the opening introduces it ("Kami dari Toko Maju mengingatkan").
 * Never says more than is true: with several notas, the customer's balance
 * may be mostly not yet due, so "overdue" is only said of the whole amount
 * when every nota is, and otherwise of the overdue part alone.
 */
export function pesanPengingat(p: DataPengingat, jam: number, namaToko?: string): string {
  const tgl = tanggal.format(dateAtLocalNoon(p.jatuhTempoTerdekat))
  const total = formatRupiah(rupiah(p.totalSisa))
  const toko = namaToko?.trim()
  const buka = `Selamat ${salam(jam)}, ${p.nama}. Kami${toko ? ` dari ${toko}` : ''} mengingatkan`
  const tutup = 'Mohon konfirmasinya. Terima kasih.'

  if (p.jumlahNota === 1) {
    const kapan = p.status === 'lewat' ? `sudah lewat jatuh tempo sejak ${tgl}` : `jatuh tempo pada ${tgl}`
    return `${buka} tagihan ${total} yang ${kapan}. ${tutup}`
  }
  if (p.status !== 'lewat') {
    return `${buka} total tagihan ${total} (${p.jumlahNota} nota), yang terdekat jatuh tempo pada ${tgl}. ${tutup}`
  }
  if (p.sisaLewat >= p.totalSisa) {
    return `${buka} tagihan ${total} (${p.jumlahNota} nota) yang sudah lewat jatuh tempo sejak ${tgl}. ${tutup}`
  }
  return `${buka} total tagihan ${total} (${p.jumlahNota} nota), di antaranya ${formatRupiah(rupiah(p.sisaLewat))} sudah lewat jatuh tempo sejak ${tgl}. ${tutup}`
}

export const linkWhatsApp = (nomor: string, pesan: string): string =>
  `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`
