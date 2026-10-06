import type { StatusTone } from '../../ui/StatusPill'
import type { StokStatus } from '../../domain/stokStatus'

/** How each stock status renders: the tone (colour plus icon) and its word. */
export const STOK_TONE: Record<StokStatus, StatusTone> = { habis: 'danger', menipis: 'warning', aman: 'success' }
export const STOK_LABEL: Record<StokStatus, string> = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' }
