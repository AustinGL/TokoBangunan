import { CategoryPills } from '../../ui/CategoryPills'
import type { StokFilterState, StokStatusFilter } from './stokList'

/**
 * Component breakdown table's row for Stok: "Search (name/barcode),
 * habis/menipis toggle, kategori pills (shared CategoryPills)."
 *
 * MASTER.md's Search field spec also describes an adjacent "Scan" button and
 * scan-keeps-focus behavior, but that is Kasir's SearchScanField (a later
 * task): Stok's search is a plain labeled text input over nama/barcode, no
 * scanner keystroke detection.
 */

type Props = {
  categories: string[]
  filters: StokFilterState
  onChange: (filters: StokFilterState) => void
}

const STATUS_TOGGLES: { value: StokStatusFilter; label: string; activeClass: string }[] = [
  { value: 'semua', label: 'Semua', activeClass: 'border-transparent bg-neutral-bg text-neutral' },
  { value: 'habis', label: 'Habis', activeClass: 'border-transparent bg-danger-bg text-danger' },
  { value: 'menipis', label: 'Menipis', activeClass: 'border-transparent bg-warning-bg text-warning' },
]

export function StockFilters({ categories, filters, onChange }: Props) {
  const kategoriOptions = [
    { value: 'semua', label: 'Semua' },
    ...categories.map(kategori => ({ value: kategori, label: kategori })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="stok-search" className="text-[14px] font-medium text-ink">
          Cari barang
        </label>
        <div className="relative">
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            id="stok-search"
            type="text"
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            placeholder="Nama, ukuran, atau barcode"
            className="h-[var(--field-h)] w-full rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] pl-9 pr-3 text-[14px] text-ink placeholder:text-[var(--field-placeholder)]"
          />
        </div>
      </div>

      <div role="group" aria-label="Filter status stok" className="flex flex-wrap gap-2">
        {STATUS_TOGGLES.map(toggle => {
          const active = filters.status === toggle.value
          return (
            <button
              key={toggle.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...filters, status: toggle.value })}
              className={`min-h-tap rounded-[var(--r-pill)] border px-4 text-[13px] font-semibold ${
                active ? toggle.activeClass : 'border-border-input bg-surface text-ink-muted'
              }`}
            >
              {toggle.label}
            </button>
          )
        })}
      </div>

      <CategoryPills
        name="stok-kategori"
        aria-label="Filter kategori"
        options={kategoriOptions}
        value={filters.kategori ?? 'semua'}
        onChange={value => onChange({ ...filters, kategori: value === 'semua' ? null : value })}
      />
    </div>
  )
}
