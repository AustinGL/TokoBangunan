import { Link } from 'react-router-dom'
import { ChevronRight, Package } from 'lucide-react'
import type { StokBarangRow } from './stokList'
import { formatRupiah, type Rupiah } from '../../domain/money'
import { StatusPill } from '../../ui/StatusPill'
import { IconTile, type IconTone } from '../../ui/IconTile'
import { UkuranChip } from '../shared/UkuranChip'
import { STOK_TONE, STOK_LABEL } from '../shared/stokTone'

const formatHargaRange = (min: Rupiah, max: Rupiah): string =>
  min === max ? formatRupiah(min) : `${formatRupiah(min)} - ${formatRupiah(max)}`

const ICON_TONE: Record<StokBarangRow['status'], IconTone> = { aman: 'neutral', menipis: 'warning', habis: 'danger' }
// A 4px reinforcement on the left edge for rows with a problem. Never the only
// signal: the StatusPill always says the word. An inset element, not a border,
// so the card corners stay clean.
const EDGE: Partial<Record<StokBarangRow['status'], string>> = { menipis: 'bg-warning', habis: 'bg-danger' }

export function StokRow({ row }: { row: StokBarangRow }) {
  const edge = EDGE[row.status]
  return (
    <Link
      to={`/stok/${row.barangId}`}
      className="relative flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition-colors duration-instant hover:bg-[var(--table-row-hover)] active:scale-[0.99]"
    >
      {edge && <span aria-hidden="true" className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${edge}`} />}
      <IconTile icon={Package} tone={ICON_TONE[row.status]} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-ink">{row.nama}</span>
            {row.kategori && <span className="block truncate text-[13px] text-ink-muted">{row.kategori}</span>}
          </div>
          <StatusPill tone={STOK_TONE[row.status]}>{STOK_LABEL[row.status]}</StatusPill>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.ukuran.map(u => (
            <UkuranChip key={u.id} ukuran={u.ukuran} quantity={u.quantity} status={u.status} />
          ))}
        </div>
        <span className="text-[13px] tabular-nums text-ink-muted">{formatHargaRange(row.hargaMin, row.hargaMax)}</span>
      </div>
      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-ink-faint" />
    </Link>
  )
}
