import { SearchField } from '../../ui/SearchField'
import { Select } from '../../ui/Select'
import { EMPTY_STOK_FILTERS, type StokFilterState } from './stokList'

/**
 * Toolbar for Stok: search (nama, ukuran or barcode), a Kategori dropdown, and
 * a Reset filter shown only while something is filtered. The status filter is
 * not here: the summary tiles above the list are that control.
 *
 * Search is a plain text input over nama/ukuran/barcode: no scanner keystroke
 * detection (that is Kasir's SearchScanField).
 */

type Props = {
  categories: string[]
  filters: StokFilterState
  onChange: (filters: StokFilterState) => void
}

export function StockFilters({ categories, filters, onChange }: Props) {
  const active = filters.search.trim() !== '' || filters.status !== 'semua' || filters.kategori !== null

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <SearchField
          id="stok-search"
          label="Cari barang"
          value={filters.search}
          onChange={search => onChange({ ...filters, search })}
          placeholder="Nama, ukuran, atau barcode"
        />
      </div>
      {categories.length > 0 && (
        <Select
          variant="pill"
          id="stok-kategori"
          label="Kategori"
          neutralValue="semua"
          options={[{ value: 'semua', label: 'Semua kategori' }, ...categories.map(kategori => ({ value: kategori, label: kategori }))]}
          value={filters.kategori ?? 'semua'}
          onChange={value => onChange({ ...filters, kategori: value === 'semua' ? null : value })}
        />
      )}
      {active && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_STOK_FILTERS)}
          className="min-h-tap rounded-pill px-3 text-[13px] font-semibold text-primary hover:underline"
        >
          Reset filter
        </button>
      )}
    </div>
  )
}
