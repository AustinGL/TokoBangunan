import { CheckCircle2, RefreshCw, AlertCircle, HardDrive, KeyRound } from 'lucide-react'
import type { SyncStatus } from '../data/sync'
import { Icon as AppIcon } from './Icon'

type Props = { status: SyncStatus; pendingCount: number }

const ICON: Record<SyncStatus, typeof CheckCircle2> = {
  'tersinkron': CheckCircle2,
  'menyimpan': RefreshCw,
  'belum-tersinkron': AlertCircle,
  'lokal': HardDrive,
  'belum-masuk': KeyRound,
}

const TONE: Record<SyncStatus, string> = {
  'tersinkron': 'text-success',
  'menyimpan': 'text-neutral',
  'belum-tersinkron': 'text-warning',
  'lokal': 'text-neutral',
  'belum-masuk': 'text-warning',
}

export function SyncIndicator({ status, pendingCount }: Props) {
  const label =
    status === 'tersinkron' ? 'Tersinkron'
    : status === 'menyimpan' ? 'Menyimpan'
    : status === 'lokal' ? 'Hanya di perangkat ini'
    : status === 'belum-masuk' ? `Belum masuk · ${pendingCount} belum tercadangkan`
    : `Belum tersinkron (${pendingCount})`

  const Glyph = ICON[status]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-xs font-medium ${TONE[status]}`}
    >
      <AppIcon icon={Glyph} size="inline" />
      <span>{label}</span>
    </div>
  )
}
