import { useMemo, useState } from 'react'
import { StockFilters } from './StockFilters'
import { ItemForm, type ItemFormValues } from './ItemForm'
import {
  useStokList, filterStokRows, EMPTY_STOK_FILTERS,
  type StokFilterState, type StokRow, type StokStatus,
} from './useStokList'
import { recordItem } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { formatRupiah, rupiah } from '../../domain/money'

/**
 * Component breakdown table's row for Stok:
 * "Joins itemsProj+stokProj in memory. habis->danger, menipis (qty <
 * stokMinimum)->warning, else success - always text+bg, never color alone."
 *
 * Also hosts Task 3's ItemForm (never mounted anywhere until this task) so
 * "+ Tambah barang" is reachable in the app: a toggle-visible inline panel,
 * no modal/dialog library, no new route.
 */

const STATUS_LABEL: Record<StokStatus, string> = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' }
const STATUS_CLASS: Record<StokStatus, string> = {
  habis: 'bg-danger-bg text-danger',
  menipis: 'bg-warning-bg text-warning',
  aman: 'bg-success-bg text-success',
}

function StatusPill({ status }: { status: StokStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--r-pill)] px-[10px] py-[4px] text-[12px] font-semibold ${STATUS_CLASS[status]}`}
    >
      {status === 'habis' && (
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      )}
      {STATUS_LABEL[status]}
    </span>
  )
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-[var(--table-row-bd)]">
      <td className="p-3" colSpan={6}>
        <div
          className="h-4 rounded-tile bg-neutral-bg"
          style={{ width: index % 2 === 0 ? '80%' : '60%' }}
        />
      </td>
    </tr>
  )
}

function StokTable({ rows }: { rows: StokRow[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border text-left">
          <th scope="col" className="p-3 text-[12px] font-semibold text-[var(--table-head-fg)]">Nama</th>
          <th scope="col" className="p-3 text-[12px] font-semibold text-[var(--table-head-fg)]">Kategori</th>
          <th scope="col" className="p-3 text-right text-[12px] font-semibold text-[var(--table-head-fg)]">Kuantitas</th>
          <th scope="col" className="p-3 text-right text-[12px] font-semibold text-[var(--table-head-fg)]">Stok minimum</th>
          <th scope="col" className="p-3 text-[12px] font-semibold text-[var(--table-head-fg)]">Status</th>
          <th scope="col" className="p-3 text-right text-[12px] font-semibold text-[var(--table-head-fg)]">Harga eceran</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.itemId} className="border-b border-[var(--table-row-bd)] text-[14px] hover:bg-[var(--table-row-hover)]">
            <td className="p-3 text-ink">{row.nama}</td>
            <td className="p-3 text-ink-muted">{row.kategori ?? '-'}</td>
            <td className="p-3 text-right tabular-nums text-ink">{row.quantity} {row.baseUnit}</td>
            <td className="p-3 text-right tabular-nums text-ink-muted">{row.stokMinimum} {row.baseUnit}</td>
            <td className="p-3"><StatusPill status={row.status} /></td>
            <td className="p-3 text-right tabular-nums text-ink">{formatRupiah(rupiah(row.hargaEceran))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ItemList() {
  const rows = useStokList()
  const [filters, setFilters] = useState<StokFilterState>(EMPTY_STOK_FILTERS)
  const [formOpen, setFormOpen] = useState(false)

  const categories = useMemo(() => {
    if (!rows) return []
    const distinct = new Set(rows.map(row => row.kategori).filter((k): k is string => Boolean(k)))
    return Array.from(distinct).sort()
  }, [rows])

  const visibleRows = useMemo(() => (rows ? filterStokRows(rows, filters) : []), [rows, filters])

  const handleSubmit = async (values: ItemFormValues) => {
    // A rejected recordItem (IndexedDB write failure, quota exceeded, and so
    // on) throws out of this await, so setFormOpen(false) below never runs:
    // the panel only closes on actual success. ItemForm awaits this same
    // promise and turns the rejection into a visible error for the user.
    await recordItem(values, { clock: systemClock, deviceId: getDeviceId() })
    setFormOpen(false)
  }

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[17px] font-bold text-ink">Stok</h1>
        <button
          type="button"
          onClick={() => setFormOpen(open => !open)}
          className="min-h-tap rounded-tile bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
        >
          + Tambah barang
        </button>
      </div>

      {formOpen && (
        <section className="rounded-card border border-border bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-[14px] font-bold text-ink">Tambah barang baru</h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="min-h-tap rounded-tile px-3 text-[13px] font-medium text-ink-muted"
            >
              Tutup
            </button>
          </div>
          <ItemForm onSubmit={handleSubmit} />
        </section>
      )}

      <StockFilters categories={categories} filters={filters} onChange={setFilters} />

      {rows === undefined ? (
        <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface">
          <span className="sr-only">Memuat daftar barang...</span>
          <table className="w-full border-collapse">
            <tbody>
              {[0, 1, 2, 3].map(index => (
                <SkeletonRow key={index} index={index} />
              ))}
            </tbody>
          </table>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Belum ada barang. Mulai tambahkan barang.
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Tidak ada barang yang cocok dengan pencarian.
        </p>
      ) : (
        <div className="rounded-card border border-border bg-surface">
          <StokTable rows={visibleRows} />
        </div>
      )}
    </main>
  )
}
