import { Plus } from 'lucide-react'
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
    <div className="flex flex-col gap-2 rounded-tile border border-border bg-surface p-3 shadow-card">
      <div>
        <p className="text-[14px] font-semibold text-ink">{barang.nama}</p>
        {barang.kategori && <p className="text-[12px] text-ink-faint">{barang.kategori}</p>}
      </div>

      <ul className="flex flex-col">
        {visibleUkuran.map(u => (
          <li key={u.id} className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-t-0">
            <div>
              <p className="text-[13px] font-medium text-ink">{u.ukuran}</p>
              <p className={`text-[12px] font-medium ${STATUS_TEXT_CLASS[u.status]}`}>
                {STATUS_LABEL[u.status]} - sisa {u.quantity}
              </p>
              <p className="text-[13px] font-bold tabular-nums text-ink">{formatRupiah(rupiah(u.hargaEceran))}</p>
            </div>
            <button
              type="button"
              onClick={() => onAdd(u)}
              aria-label={`Tambah ${barang.nama} ${u.ukuran} ke keranjang`}
              className="flex min-h-tap min-w-tap items-center justify-center rounded-tile bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]"
            >
              <Plus aria-hidden="true" size={20} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
