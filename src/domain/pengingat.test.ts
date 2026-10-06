import { describe, it, expect } from 'vitest'
import { nomorWhatsApp, pesanPengingat, linkWhatsApp } from './pengingat'

describe('nomorWhatsApp', () => {
  it('turns every common way of writing an Indonesian mobile number into 62...', () => {
    for (const written of ['0812-5550-101', '0812 5550 101', '+62 812-5550-101', '62812 5550 101', '812-5550-101', '(0812) 5550101']) {
      expect(nomorWhatsApp(written), written).toBe('628125550101')
    }
  })

  it('accepts the 0062 international prefix and a stray 0 after 62', () => {
    expect(nomorWhatsApp('0062 812 5550 101')).toBe('628125550101')
    expect(nomorWhatsApp('620812 5550 101')).toBe('628125550101')
  })

  it('is null for nothing, blanks, letters, and numbers that are too short or foreign', () => {
    expect(nomorWhatsApp(undefined)).toBeNull()
    expect(nomorWhatsApp('')).toBeNull()
    expect(nomorWhatsApp('   ')).toBeNull()
    expect(nomorWhatsApp('belum ada')).toBeNull()
    expect(nomorWhatsApp('0812')).toBeNull()
    expect(nomorWhatsApp('0812-555')).toBeNull()
    expect(nomorWhatsApp('+1 415 555 2671')).toBeNull()
  })

  it('is null for an absurdly long number', () => {
    expect(nomorWhatsApp('0812555010112345678901')).toBeNull()
  })
})

const data = (over: Partial<Parameters<typeof pesanPengingat>[0]> = {}) => ({
  nama: 'Budi', totalSisa: 450_000, sisaLewat: 450_000, jumlahNota: 2, status: 'lewat' as const, jatuhTempoTerdekat: '2026-09-25', ...over,
})

describe('pesanPengingat', () => {
  it('overdue: names the amount, the number of notas, and since when', () => {
    expect(pesanPengingat(data(), 13)).toBe(
      'Selamat siang, Budi. Kami mengingatkan tagihan Rp 450.000 (2 nota) yang sudah lewat jatuh tempo sejak 25 Sep 2026. Mohon konfirmasinya. Terima kasih.',
    )
  })

  it('not yet overdue (segera or berjalan), one nota: says it falls due on the date', () => {
    for (const status of ['segera', 'berjalan'] as const) {
      expect(pesanPengingat(data({ status, jumlahNota: 1, sisaLewat: 0, jatuhTempoTerdekat: '2026-10-20' }), 13)).toContain('yang jatuh tempo pada 20 Okt 2026.')
    }
  })

  it('not yet overdue with several notas: gives the total and says only that the nearest falls due on the date', () => {
    const pesan = pesanPengingat(data({ status: 'berjalan', sisaLewat: 0, jatuhTempoTerdekat: '2026-10-20' }), 13)
    expect(pesan).toContain('total tagihan Rp 450.000 (2 nota), yang terdekat jatuh tempo pada 20 Okt 2026.')
    expect(pesan).not.toContain('sudah lewat')
  })

  it('only part overdue: never calls the whole balance overdue, and names the overdue part', () => {
    const pesan = pesanPengingat(data({ totalSisa: 3_200_000, sisaLewat: 200_000, jatuhTempoTerdekat: '2026-09-28' }), 13)
    expect(pesan).toBe(
      'Selamat siang, Budi. Kami mengingatkan total tagihan Rp 3.200.000 (2 nota), di antaranya Rp 200.000 sudah lewat jatuh tempo sejak 28 Sep 2026. Mohon konfirmasinya. Terima kasih.',
    )
  })

  it('every nota overdue: still says the whole amount is overdue', () => {
    expect(pesanPengingat(data({ totalSisa: 300_000, sisaLewat: 300_000 }), 13)).toContain('tagihan Rp 300.000 (2 nota) yang sudah lewat jatuh tempo sejak')
  })

  it('one nota is not announced as "(1 nota)"', () => {
    const pesan = pesanPengingat(data({ jumlahNota: 1, totalSisa: 100_000 }), 13)
    expect(pesan).toContain('tagihan Rp 100.000 yang')
    expect(pesan).not.toContain('(1 nota)')
  })

  it('greets by the hour: pagi, siang, sore, malam, at their boundaries', () => {
    const salam = (jam: number) => pesanPengingat(data(), jam).split(',')[0]
    expect(salam(0)).toBe('Selamat pagi')
    expect(salam(10)).toBe('Selamat pagi')
    expect(salam(11)).toBe('Selamat siang')
    expect(salam(14)).toBe('Selamat siang')
    expect(salam(15)).toBe('Selamat sore')
    expect(salam(17)).toBe('Selamat sore')
    expect(salam(18)).toBe('Selamat malam')
    expect(salam(23)).toBe('Selamat malam')
  })
})

describe('linkWhatsApp', () => {
  it('builds a wa.me link with the message URL-encoded', () => {
    const link = linkWhatsApp('628125550101', 'Halo, Budi & Sari. Rp 5.000?')
    expect(link).toBe(`https://wa.me/628125550101?text=${encodeURIComponent('Halo, Budi & Sari. Rp 5.000?')}`)
    expect(new URL(link).searchParams.get('text')).toBe('Halo, Budi & Sari. Rp 5.000?')
  })
})

describe('pesanPengingat: nama toko', () => {
  it('introduces the shop in the opening when it has a name', () => {
    expect(pesanPengingat(data(), 13, 'Toko Maju')).toBe(
      'Selamat siang, Budi. Kami dari Toko Maju mengingatkan tagihan Rp 450.000 (2 nota) yang sudah lewat jatuh tempo sejak 25 Sep 2026. Mohon konfirmasinya. Terima kasih.',
    )
  })

  it('with no name, an empty name or a blank one the message is exactly what it was', () => {
    const tanpa = pesanPengingat(data(), 13)
    expect(pesanPengingat(data(), 13, undefined)).toBe(tanpa)
    expect(pesanPengingat(data(), 13, '')).toBe(tanpa)
    expect(pesanPengingat(data(), 13, '   ')).toBe(tanpa)
    expect(tanpa).toContain('Kami mengingatkan')
    expect(tanpa).not.toContain('dari')
  })

  it('trims the name', () => {
    expect(pesanPengingat(data(), 13, '  Toko Maju  ')).toContain('Kami dari Toko Maju mengingatkan')
  })

  it('every branch of the sentence keeps its own wording and gains only the introduction', () => {
    const kasus = [
      data({ jumlahNota: 1, status: 'segera' as const, sisaLewat: 0, jatuhTempoTerdekat: '2026-10-20' }),
      data({ status: 'berjalan' as const, sisaLewat: 0, jatuhTempoTerdekat: '2026-10-20' }),
      data({ totalSisa: 3_200_000, sisaLewat: 200_000 }),
      data({ jumlahNota: 1 }),
      data(),
    ]
    for (const k of kasus) {
      const tanpa = pesanPengingat(k, 13)
      expect(pesanPengingat(k, 13, 'Toko Maju')).toBe(tanpa.replace('Kami mengingatkan', 'Kami dari Toko Maju mengingatkan'))
    }
  })
})
