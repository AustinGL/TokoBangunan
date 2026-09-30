import { AlertCircle, AlertTriangle, Package } from 'lucide-react'
import { StatTile } from '../../ui/StatTile'
import type { StokStatusFilter, StokSummary } from './stokList'

type Props = {
  summary: StokSummary
  status: StokStatusFilter
  onChange: (status: StokStatusFilter) => void
}

/**
 * The whole-stock overview AND the status filter: one control, not two. The
 * counts always describe every row (the caller passes the unfiltered
 * summary), so they stay a stable overview while search and kategori narrow
 * the list. Clicking the pressed tile clears the filter.
 */
export function StokSummaryTiles({ summary, status, onChange }: Props) {
  const toggle = (target: Exclude<StokStatusFilter, 'semua'>) => onChange(status === target ? 'semua' : target)

  return (
    <div role="group" aria-label="Filter status stok" className="grid grid-cols-3 gap-2 md:gap-3">
      <StatTile
        label="Semua barang" value={summary.totalBarang} icon={Package}
        pressed={status === 'semua'} onClick={() => onChange('semua')}
      />
      <StatTile
        label="Menipis" value={summary.menipisCount} icon={AlertTriangle} tone="warning"
        pressed={status === 'menipis'} onClick={() => toggle('menipis')}
      />
      <StatTile
        label="Habis" value={summary.habisCount} icon={AlertCircle} tone="danger"
        pressed={status === 'habis'} onClick={() => toggle('habis')}
      />
    </div>
  )
}
