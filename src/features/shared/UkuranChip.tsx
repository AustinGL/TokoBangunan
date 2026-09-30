import { AlertCircle, AlertTriangle } from 'lucide-react'
import type { StokStatus } from '../../domain/stokStatus'

const CLASS: Record<StokStatus, string> = {
  aman: 'border-border-input bg-surface text-ink-muted',
  menipis: 'border-transparent bg-warning-bg text-warning',
  habis: 'border-transparent bg-danger-bg text-danger',
}

/**
 * A value chip ("50 kg · 32"), tinted by that ukuran's stock status. Habis
 * and Menipis also carry an icon and a hidden word, so the tint is never the
 * only signal. The visible text stays one text node so it reads as one value.
 */
export function UkuranChip({ ukuran, quantity, status }: { ukuran: string; quantity: number; status: StokStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill border px-3 py-1 text-[12px] tabular-nums ${CLASS[status]}`}>
      {status === 'habis' && <AlertCircle aria-hidden="true" size={12} />}
      {status === 'menipis' && <AlertTriangle aria-hidden="true" size={12} />}
      {status !== 'aman' && <span className="sr-only">{`stok ${status}`}</span>}
      {`${ukuran} · ${quantity}`}
    </span>
  )
}
