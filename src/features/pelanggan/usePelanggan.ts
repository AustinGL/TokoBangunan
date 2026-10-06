import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { daftarPelanggan, kelebihanBayar, riwayatBon, type BarisPelanggan, type NotaRiwayat } from '../../domain/pelanggan'
import { hitungPiutang, type PembayaranRiwayat } from '../../domain/piutang'
import { useHariIni } from '../shared/useHariIni'

/** Every customer with what they still owe. Undefined while the first query resolves. */
export function useDaftarPelanggan(): BarisPelanggan[] | undefined {
  const hariIni = useHariIni()
  return useLiveQuery(async () => {
    const [sales, payments, customers] = await Promise.all([
      db.salesProj.filter(s => s.metodeBayar === 'bon').toArray(),
      db.paymentsProj.toArray(),
      db.customersProj.toArray(),
    ])
    return daftarPelanggan(customers, hitungPiutang(sales, payments, customers, hariIni), kelebihanBayar(sales, payments))
  }, [hariIni])
}

export type DetailPelanggan = {
  customer: { id: string; nama: string; telepon?: string; alamat?: string; termynHari: number } | null
  totalSisa: number
  /** Paid beyond what the Bon notas came to (a payment recorded on two devices); 0 normally. */
  kelebihan: number
  nota: NotaRiwayat[]
  pembayaran: PembayaranRiwayat[]
}

/** One customer, their balance and their whole Bon history. Undefined while loading. */
export function useDetailPelanggan(customerId: string | undefined): DetailPelanggan | undefined {
  return useLiveQuery(async () => {
    if (!customerId) return { customer: null, totalSisa: 0, kelebihan: 0, nota: [], pembayaran: [] }
    const [sales, payments, customer] = await Promise.all([
      db.salesProj.filter(s => s.metodeBayar === 'bon' && s.customerId === customerId).toArray(),
      db.paymentsProj.toArray(),
      db.customersProj.get(customerId),
    ])
    const { nota, pembayaran } = riwayatBon(sales, payments, customerId)
    return {
      customer: customer
        ? { id: customer.id, nama: customer.nama, telepon: customer.telepon, alamat: customer.alamat, termynHari: customer.termynHari }
        : null,
      totalSisa: nota.reduce((sum, n) => sum + n.sisa, 0),
      kelebihan: nota.reduce((sum, n) => sum + n.lebih, 0),
      nota,
      pembayaran,
    }
  }, [customerId])
}
