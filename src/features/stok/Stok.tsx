import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { BookOpen, SearchX } from 'lucide-react'
import { useKatalog } from '../shared/useKatalog'
import { StockFilters } from './StockFilters'
import { StokSummaryTiles } from './StokSummaryTiles'
import { StokRow } from './StokRow'
import { TambahStokSheet } from './TambahStokSheet'
import { toStokRows, filterStokRows, summarizeStokRows, EMPTY_STOK_FILTERS, type StokFilterState } from './stokList'
import { PageHeader } from '../../ui/PageHeader'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'

export function Stok() {
  const katalog = useKatalog()
  const [filters, setFilters] = useState<StokFilterState>(EMPTY_STOK_FILTERS)
  const [searchParams, setSearchParams] = useSearchParams()
  const tambahStokOpen = searchParams.get('tambah') === '1'
  // Beranda's "Perlu diurus" rows deep-link here with the barang and ukuran
  // already chosen, so the owner lands on the fix, not on a form to fill.
  const initialBarangId = searchParams.get('barang')
  const initialItemId = searchParams.get('ukuran')

  const openTambahStok = () => {
    const next = new URLSearchParams(searchParams)
    next.set('tambah', '1')
    setSearchParams(next)
  }

  const closeTambahStok = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('tambah')
    next.delete('barang')
    next.delete('ukuran')
    // replace, not push: opening the sheet already added its own history
    // entry, so closing it must overwrite that entry rather than stack a
    // second one on top - otherwise the browser's own Back button, pressed
    // once after closing, lands back on ?tambah=1 and silently re-opens
    // the sheet with an empty form instead of leaving Stok.
    setSearchParams(next, { replace: true })
  }

  // toStokRows/summarizeStokRows run over EVERY row katalog produced, never
  // the filtered subset - the tiles must stay a stable "whole stock"
  // overview while search/status/kategori narrow only the list below them
  // (Review Focus: the summary must not shrink to match a search).
  const allRows = useMemo(() => (katalog ? toStokRows(katalog) : []), [katalog])
  const summary = useMemo(() => summarizeStokRows(allRows), [allRows])
  const visibleRows = useMemo(() => filterStokRows(allRows, filters), [allRows, filters])

  const categories = useMemo(() => {
    const distinct = new Set(allRows.map(r => r.kategori).filter((k): k is string => Boolean(k)))
    return Array.from(distinct).sort()
  }, [allRows])

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <PageHeader
        title="Stok"
        subtitle={katalog !== undefined ? `${summary.totalBarang} barang` : undefined}
        action={
          <button
            type="button"
            onClick={openTambahStok}
            className="min-h-tap rounded-pill bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
          >
            + Tambah stok
          </button>
        }
      />

      {/* Nothing to summarise or filter while loading or with no stock at all. */}
      {allRows.length > 0 && (
        <>
          <StokSummaryTiles
            summary={summary}
            status={filters.status}
            onChange={status => setFilters({ ...filters, status })}
          />
          <StockFilters categories={categories} filters={filters} onChange={setFilters} />
        </>
      )}

      {katalog === undefined ? (
        <ListSkeleton label="Memuat daftar stok..." />
      ) : allRows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          action={
            <Link
              to="/kamus"
              className="inline-flex min-h-tap items-center rounded-pill border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)]"
            >
              Buka Kamus Barang
            </Link>
          }
        >
          Belum ada stok. Tambahkan barang di menu Kamus Barang.
        </EmptyState>
      ) : visibleRows.length === 0 ? (
        <EmptyState icon={SearchX}>Tidak ada barang yang cocok dengan pencarian atau filter.</EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visibleRows.map(row => (
            <li key={row.barangId}>
              <StokRow row={row} />
            </li>
          ))}
        </ul>
      )}

      {tambahStokOpen && (
        <TambahStokSheet open onClose={closeTambahStok} initialBarangId={initialBarangId} initialItemId={initialItemId} />
      )}
    </main>
  )
}
