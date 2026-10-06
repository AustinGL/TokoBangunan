import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { bulanDari, namaBulan, namaLengkap } from '../domain/kalender'

/**
 * Drives the date pickers by clicking, so a test never depends on today's date:
 * it opens the card and turns the pages until the wanted day is on screen.
 */

const NAMA_BULAN = Array.from({ length: 12 }, (_, i) => namaBulan({ tahun: 2000, bulan: i }).replace(' 2000', ''))

const kartu = (): HTMLElement => screen.getByRole('dialog', { name: /^Kalender / })

/** Months from the first month on show to the one holding `key`. */
const selisihBulan = (judul: string, key: string): number => {
  const [nama, tahun] = judul.split(' ')
  const sekarang = Number(tahun) * 12 + NAMA_BULAN.indexOf(nama)
  const b = bulanDari(key)
  return b.tahun * 12 + b.bulan - sekarang
}

export async function bukaKalender(user: UserEvent, nama: string | RegExp): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: nama }))
  return kartu()
}

/** The button of day `key`, turning pages until it is shown. Throws if the calendar cannot reach it. */
export async function keTanggal(user: UserEvent, key: string): Promise<HTMLElement> {
  for (let i = 0; i < 60; i += 1) {
    const kini = within(kartu())
    const tombol = kini.queryByRole('button', { name: namaLengkap(key) })
    if (tombol) return tombol
    const selisih = selisihBulan(kini.getAllByRole('heading')[0].textContent ?? '', key)
    await user.click(kini.getByRole('button', { name: selisih > 0 ? 'Bulan berikutnya' : 'Bulan sebelumnya' }))
  }
  throw new Error(`Calendar cannot reach ${key}`)
}

export async function pilihTanggal(user: UserEvent, nama: string | RegExp, key: string): Promise<void> {
  await bukaKalender(user, nama)
  await user.click(await keTanggal(user, key))
}

export async function pilihRentang(user: UserEvent, nama: string | RegExp, dari: string, sampai: string): Promise<void> {
  await bukaKalender(user, nama)
  await user.click(await keTanggal(user, dari))
  await user.click(await keTanggal(user, sampai))
}
