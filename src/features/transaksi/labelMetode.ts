import type { Sale } from '../../domain/projections/sales'

const LABEL: Record<Sale['metodeBayar'], string> = { tunai: 'Tunai', bon: 'Bon', transfer: 'Transfer', qris: 'QRIS' }

/** The words for how a sale was paid; a row from a later release's unknown method is shown as it is. */
export const labelMetode = (metode: string): string => LABEL[metode as Sale['metodeBayar']] ?? metode
