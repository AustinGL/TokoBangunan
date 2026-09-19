import type { SyncStatus } from '../data/sync'

type Props = { status: SyncStatus; pendingCount: number }

const ICON: Record<SyncStatus, string> = {
  'tersinkron': 'M20 6L9 17l-5-5',        // check
  'menyimpan': 'M12 3v3m0 12v3M3 12h3m12 0h3',  // activity
  'belum-tersinkron': 'M12 9v4m0 4h.01',  // alert
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

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-[12px] font-medium ${TONE[status]}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2" strokeLinecap="round"
           aria-hidden="true">
        <path d={ICON[status]} />
      </svg>
      <span>{label}</span>
    </div>
  )
}
