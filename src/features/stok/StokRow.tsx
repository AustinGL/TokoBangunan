import { Link } from 'react-router-dom'
import { ChevronRight, Package } from 'lucide-react'
import type { StokBarangRow } from './stokList'
import { formatRupiah, type Rupiah } from '../../domain/money'
import { StatusPill } from '../../ui/StatusPill'
import { IconTile, type IconTone } from '../../ui/IconTile'
import { Icon } from '../../ui/Icon'
import { UkuranChip } from '../shared/UkuranChip'
import { STOK_TONE, STOK_LABEL } from '../shared/stokTone'

const formatHargaRange = (min: Rupiah, max: Rupiah): string =>
  min === max ? formatRupiah(min) : `${formatRupiah(min)} - ${formatRupiah(max)}`

const ICON_TONE: Record<StokBarangRow['status'], IconTone> = { aman: 'neutral', menipis: 'warning', habis: 'danger' }
export function StokRow({ row }: { row: StokBarangRow }) {
  return (
    <Link
      to={`/stok/${row.barangId}`}
      className="relative flex items-center gap-3 bg-surface p-4 transition-colors duration-instant hover:bg-[var(--table-row-hover)] active:bg-fill md:px-5"
    >
      <IconTile icon={Package} tone={ICON_TONE[row.status]} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block truncate text-base font-semibold text-ink">{row.nama}</span>
            {row.kategori && <span className="block truncate text-sm text-ink-muted">{row.kategori}</span>}
          </div>
          <StatusPill tone={STOK_TONE[row.status]}>{STOK_LABEL[row.status]}</StatusPill>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.ukuran.map(u => (
            <UkuranChip key={u.id} ukuran={u.ukuran} quantity={u.quantity} status={u.status} />
          ))}
        </div>
        <span className="text-sm tabular-nums text-ink-muted">{formatHargaRange(row.hargaMin, row.hargaMax)}</span>
      </div>
      <Icon icon={ChevronRight} size="button" className="shrink-0 text-ink-faint" />
    </Link>
  )
}
