import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useKatalog } from '../shared/useKatalog'
import { StockFilters } from './StockFilters'
import { TambahStokSheet } from './TambahStokSheet'
import { toStokRows, filterStokRows, summarizeStokRows, EMPTY_STOK_FILTERS, type StokFilterState } from './stokList'
import { formatRupiah, type Rupiah } from '../../domain/money'

const STATUS_LABEL: Record<string, string> = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' }
const STATUS_CLASS: Record<string, string> = {
  habis: 'bg-danger-bg text-danger', menipis: 'bg-warning-bg text-warning', aman: 'bg-success-bg text-success',
}

const formatHargaRange = (min: Rupiah, max: Rupiah): string => (min === max ? formatRupiah(min) : `${formatRupiah(min)} - ${formatRupiah(max)}`)

export function Stok() {
  const katalog = useKatalog()
  const [filters, setFilters] = useState<StokFilterState>(EMPTY_STOK_FILTERS)
  const [searchParams, setSearchParams] = useSearchParams()
  const tambahStokOpen = searchParams.get('tambah') === '1'

  const openTambahStok = () => {
    const next = new URLSearchParams(searchParams)
    next.set('tambah', '1')
    setSearchParams(next)
  }

  const closeTambahStok = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('tambah')
    // replace, not push: opening the sheet already added its own history
    // entry, so closing it must overwrite that entry rather than stack a
    // second one on top - otherwise the browser's own Back button, pressed
    // once after closing, lands back on ?tambah=1 and silently re-opens
    // the sheet with an empty form instead of leaving Stok.
    setSearchParams(next, { replace: true })
  }

  // toStokRows/summarizeStokRows run over EVERY row katalog produced, never
  // the filtered subset - the header must stay a stable "whole stock"
  // overview while search/status/kategori narrow only the list below it
  // (Review Focus: the summary must not shrink to match a search).
  const allRows = useMemo(() => (katalog ? toStokRows(katalog) : []), [katalog])
  const summary = useMemo(() => summarizeStokRows(allRows), [allRows])
  const visibleRows = useMemo(() => filterStokRows(allRows, filters), [allRows, filters])

  const categories = useMemo(() => {
    const distinct = new Set(allRows.map(r => r.kategori).filter((k): k is string => Boolean(k)))
    return Array.from(distinct).sort()
  }, [allRows])

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[17px] font-bold text-ink">Stok</h1>
          {katalog !== undefined && (
            <p className="text-[13px] text-ink-muted">
              {summary.totalBarang} barang · {summary.menipisCount} menipis · {summary.habisCount} habis
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openTambahStok}
          className="min-h-tap rounded-tile bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
        >
          + Tambah stok
        </button>
      </div>

      <StockFilters categories={categories} filters={filters} onChange={setFilters} />

      {katalog === undefined ? (
        <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Memuat daftar stok...
        </div>
      ) : allRows.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Belum ada stok. Tambahkan barang di menu Kamus Barang.
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Tidak ada barang yang cocok dengan pencarian atau filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleRows.map(row => (
            <li key={row.barangId}>
              <Link
                to={`/stok/${row.barangId}`}
                className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
              >
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{row.nama}</span>
                  {row.kategori && <span className="text-[13px] text-ink-muted">· {row.kategori}</span>}
                </span>
                <span className={`inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[12px] font-semibold ${STATUS_CLASS[row.status]}`}>
                  {STATUS_LABEL[row.status]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.ukuran.map(u => (
                  <span key={u.id} className="rounded-[var(--r-pill)] border border-border-input px-3 py-1 text-[12px] text-ink-muted">
                    {u.ukuran} · {u.quantity}
                  </span>
                ))}
              </div>
              <span className="text-[13px] text-ink-muted">{formatHargaRange(row.hargaMin, row.hargaMax)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {tambahStokOpen && <TambahStokSheet open onClose={closeTambahStok} />}
    </main>
  )
}
