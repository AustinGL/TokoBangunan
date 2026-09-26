import { CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react'
import type { SyncStatus } from '../data/sync'

type Props = { status: SyncStatus; pendingCount: number }

const ICON: Record<SyncStatus, typeof CheckCircle2> = {
  'tersinkron': CheckCircle2,
  'menyimpan': RefreshCw,
  'belum-tersinkron': AlertCircle,
}

const TONE: Record<SyncStatus, string> = {
  'tersinkron': 'text-success',
  'menyimpan': 'text-neutral',
  'belum-tersinkron': 'text-warning',
}

export function SyncIndicator({ status, pendingCount }: Props) {
  const label =
    status === 'tersinkron' ? 'Tersinkron'
    : status === 'menyimpan' ? 'Menyimpan'
    : `Belum tersinkron (${pendingCount})`

  const Icon = ICON[status]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-[12px] font-medium ${TONE[status]}`}
    >
      <Icon aria-hidden="true" size={14} />
      <span>{label}</span>
    </div>
  )
}
