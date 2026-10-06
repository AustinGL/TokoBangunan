import { AlertCircle, AlertTriangle } from 'lucide-react'
import type { StokStatus } from '../../domain/stokStatus'
import { Icon } from '../../ui/Icon'

const CLASS: Record<StokStatus, string> = {
  aman: 'border-transparent bg-fill-tertiary text-ink-muted',
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
    <span className={`inline-flex items-center gap-1 rounded-pill border px-3 py-1 text-xs tabular-nums ${CLASS[status]}`}>
      {status === 'habis' && <Icon icon={AlertCircle} size="micro" />}
      {status === 'menipis' && <Icon icon={AlertTriangle} size="micro" />}
      {status !== 'aman' && <span className="sr-only">{`stok ${status}`}</span>}
      {`${ukuran} · ${quantity}`}
    </span>
  )
}
