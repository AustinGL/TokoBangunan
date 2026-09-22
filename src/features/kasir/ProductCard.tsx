import { formatRupiah, rupiah } from '../../domain/money'
import type { ProductStatus, ProductRow } from './useProductCatalog'

/**
 * Component breakdown table's exact row for this component:
 * "44px add button, aria-label='Tambah [nama] ke keranjang', same
 * stock-status coloring as Stok."
 *
 * MASTER.md section 8, verbatim:
 * "Icon chip (--mint-tint), name (14/600), stock line colored by status
 * (habis to danger, menipis to warning, otherwise ink-faint), and a price
 * row (price 15/800 tabular-nums, unit in ink-faint), plus an add button.
 * The add button is 44px, not 34px. It is the most-tapped control in the
 * app and it meets the same touch floor as everything else. If 44px crowds
 * the card, the grid gets fewer columns, not a smaller button.
 * aria-label='Tambah [nama barang] ke keranjang'."
 *
 * Presentational only: clicking add calls onAdd(item), it never touches
 * useCart or any command/Dexie function directly, so ProductGrid (or a
 * differently-assembled Task 6b screen) fully owns the cart.
 */

const STATUS_LABEL: Record<ProductStatus, string> = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' }
const STATUS_TEXT_CLASS: Record<ProductStatus, string> = {
  habis: 'text-danger',
  menipis: 'text-warning',
  aman: 'text-ink-faint',
}

type Props = {
  item: ProductRow
  onAdd: (item: ProductRow) => void
}

export function ProductCard({ item, onAdd }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-tile border border-border bg-surface p-3 shadow-card">
      <div className="flex size-10 items-center justify-center rounded-tile bg-mint-tint">
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" className="text-primary"
        >
          <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
          <path d="M3 8l9 5 9-5M12 13v8" />
        </svg>
      </div>

      <p className="text-[14px] font-semibold text-ink">{item.nama}</p>

      {/* Text carries the status, not color alone: the label itself differs
          (Habis/Menipis/Aman), the color is reinforcement. */}
      <p className={`text-[12px] font-medium ${STATUS_TEXT_CLASS[item.status]}`}>
        {STATUS_LABEL[item.status]} - {item.quantity} {item.baseUnit}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[15px] font-extrabold tabular-nums text-ink">
            {formatRupiah(rupiah(item.hargaEceran))}
          </p>
          <p className="text-[12px] text-ink-faint">/{item.baseUnit}</p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(item)}
          aria-label={`Tambah ${item.nama} ke keranjang`}
          className="flex min-h-tap min-w-tap items-center justify-center rounded-tile bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]"
        >
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  )
}
