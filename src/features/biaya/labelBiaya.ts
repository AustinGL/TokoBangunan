import { KATEGORI_BIAYA, type KategoriBiaya } from '../../domain/events'

export const LABEL_BIAYA: Record<KategoriBiaya, string> = {
  gaji: 'Gaji',
  sewa: 'Sewa',
  listrik: 'Listrik',
  transport: 'Transport',
  lainnya: 'Lainnya',
}

export const OPSI_BIAYA: Array<{ value: KategoriBiaya; label: string }> =
  KATEGORI_BIAYA.map(value => ({ value, label: LABEL_BIAYA[value] }))

/** The label for a stored kategori; an unknown one (a later release's) is shown as it is. */
export const labelBiaya = (kategori: string): string => LABEL_BIAYA[kategori as KategoriBiaya] ?? kategori
