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

  return (
    <div className="card-in flex flex-col gap-1 rounded-card bg-surface p-4 shadow-card transition-shadow duration-quick hover:shadow-float">
      <div className="pb-1">
        <p className="text-base font-semibold text-ink">{barang.nama}</p>
        {barang.kategori && <p className="text-xs text-ink-faint">{barang.kategori}</p>}
      </div>

      <ul className="flex flex-col divide-y divide-separator">
        {visibleUkuran.map(u => (
          <li key={u.id} className="flex items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-medium text-ink">{u.ukuran}</p>
              <p className={`text-xs font-medium ${STATUS_TEXT_CLASS[u.status]}`}>
                {STATUS_LABEL[u.status]} - sisa {u.quantity}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{formatRupiah(rupiah(u.hargaEceran))}</p>
            </div>
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
