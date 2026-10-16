import { Plus } from 'lucide-react'
import { IconButton } from '../../ui/IconButton'
import { formatRupiah, rupiah } from '../../domain/money'
import type { BarangRow, UkuranRow } from '../shared/useKatalog'
import type { StokStatus } from '../../domain/stokStatus'

/**
 * Now a barang card listing its own ukuran rows, per the redesign spec's
 * Kasir mockup: "barang cards listing their ukuran rows (50 kg · @ 65.000 ·
 * sisa 32 · [+]), aria-label 'Tambah Semen Tiga Roda 50 kg ke keranjang'."
 * Presentational only: clicking add calls onAdd(ukuran), it never touches
 * useCart or any command/Dexie function directly - ProductGrid (or Kasir.tsx)
 * fully owns the cart.
 */

const STATUS_LABEL: Record<StokStatus, string> = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' }
const STATUS_TEXT_CLASS: Record<StokStatus, string> = {
  habis: 'text-danger',
  menipis: 'text-warning',
  aman: 'text-ink-faint',
}

type Props = {
  barang: BarangRow
  onAdd: (ukuran: UkuranRow) => void
}

export function ProductCard({ barang, onAdd }: Props) {
  const visibleUkuran = barang.ukuran.filter(u => !u.diarsipkan)

  // Compact on purpose: a phone showed only three of the old cards per screen.
  // Name and kategori share a line, and each ukuran is one row whose prices
  // line up in a column before the add button, so a cashier scans down them.
  return (
    <div className="card-in flex flex-col rounded-card bg-surface px-4 pt-3 pb-1.5 shadow-card transition-shadow duration-quick hover:shadow-float">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-base font-semibold text-ink">{barang.nama}</p>
        {barang.kategori && <p className="shrink-0 text-xs text-ink-faint">{barang.kategori}</p>}
      </div>

      <ul className="flex flex-col divide-y divide-separator">
        {visibleUkuran.map(u => (
          <li key={u.id} className="flex items-center gap-3 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{u.ukuran}</p>
              <p className={`text-xs font-medium ${STATUS_TEXT_CLASS[u.status]}`}>
                {STATUS_LABEL[u.status]} - sisa {u.quantity}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatRupiah(rupiah(u.hargaEceran))}</p>
            <IconButton
              icon={Plus}
              variant="primary"
              label={`Tambah ${barang.nama} ${u.ukuran} ke keranjang`}
              onClick={() => onAdd(u)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
