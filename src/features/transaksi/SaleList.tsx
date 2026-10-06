import { useRef, useState, type KeyboardEvent } from 'react'
import { labelMetode } from './labelMetode'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Sale } from '../../domain/projections/sales'
import { formatRupiah, rupiah } from '../../domain/money'
import { TanggalFilter } from './TanggalFilter'
import { SaleDetail } from './SaleDetail'
import { formatTanggal, formatJam } from '../shared/formatTanggal'
import { shortNota } from '../../domain/nota'
import { StatusPill } from '../../ui/StatusPill'
import { ReceiptText, Wallet, Ban } from 'lucide-react'
import { PageHeader } from '../../ui/PageHeader'
import { StatTile } from '../../ui/StatTile'
import { EmptyState } from '../../ui/EmptyState'
import { Sheet } from '../../ui/Sheet'
import { useIsCompact } from '../shared/useIsCompact'

/**
 * Component breakdown table's exact row: "Transaksi list |
 * features/transaksi/SaleList.tsx | Section 7 Tables | Reads salesProj
 * sorted occurredAt desc. batal status uses neutral coloring (not danger -
 * cancellation isn't an error state)."
 *
 * Also this screen's assembly root (the same role ItemList.tsx plays for
 * /stok and Kasir.tsx plays for /kasir): hosts TanggalFilter and, per the
 * plan's Reference section naming only /stok, /kasir, /transaksi as real
 * routes, opens SaleDetail inline rather than as a /transaksi/:id route.
 *
 * Wide screens are a master-detail split: the nota sits on the left and stays
 * on screen (sticky) while the list scrolls on the right, and the newest sale
 * is always the one open, so moving between sales never means scrolling past
 * the nota. A phone has no room for two columns: the list is the screen, and a
 * tap opens the nota in a bottom sheet.
 */

function SaleStatusPill({ status }: { status: Sale['status'] }) {
  // batal is neutral, never danger: cancellation is a legitimate, intentional
  // business action, not a failure state.
  return <StatusPill tone={status === 'aktif' ? 'success' : 'neutral'}>{status === 'aktif' ? 'Aktif' : 'Batal'}</StatusPill>
}

function lineSummary(sale: Sale): string {
  if (sale.lines.length === 0) return '-'
  const [first, ...rest] = sale.lines
  return rest.length === 0 ? first.nama : `${first.nama} +${rest.length} lainnya`
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-[var(--table-row-bd)]">
      <td className="p-3" colSpan={5}>
        <div
          className="h-4 rounded-tile bg-neutral-bg"
          style={{ width: index % 2 === 0 ? '80%' : '60%' }}
        />
      </td>
    </tr>
  )
}

function SaleTable({ rows, activeId, arrowNav, onSelect }: {
  rows: Sale[]
  /** The sale whose nota is open; its row is highlighted. */
  activeId: string | null
  /** Up/Down on a nota button moves to the neighbouring sale (split view only: on a phone a move would pop a sheet). */
  arrowNav: boolean
  onSelect: (saleId: string) => void
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!arrowNav || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
    const next = rows[index + (e.key === 'ArrowDown' ? 1 : -1)]
    if (!next) return
    e.preventDefault()
    onSelect(next.id)
    buttons.current.get(next.id)?.focus()
  }

  return (
    <table aria-label="Daftar transaksi" className="w-full border-collapse">
      <thead className="sticky top-0 z-sticky bg-surface">
        <tr className="border-b border-separator text-left">
          <th scope="col" className="p-3 text-xs font-semibold text-[var(--table-head-fg)]">Tanggal</th>
          <th scope="col" className="p-3 text-xs font-semibold text-[var(--table-head-fg)]">Barang</th>
          <th scope="col" className="p-3 text-right text-xs font-semibold text-[var(--table-head-fg)]">Total</th>
          <th scope="col" className="p-3 text-xs font-semibold text-[var(--table-head-fg)] max-md:hidden lg:hidden">Metode</th>
          <th scope="col" className="p-3 text-xs font-semibold text-[var(--table-head-fg)] max-md:sr-only">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((sale, index) => (
          // The nota number in the first cell is the real control (a button,
          // so a screen reader announces it and Enter/Space just work). The
          // row click stays as a convenience for a mouse or finger, and is
          // deliberately not focusable itself.
          <tr
            key={sale.id}
            onClick={() => onSelect(sale.id)}
            className={`cursor-pointer border-b border-[var(--table-row-bd)] text-sm transition-colors duration-instant last:border-b-0 ${
              sale.id === activeId ? 'bg-accent-50' : 'hover:bg-[var(--table-row-hover)]'
            }`}
          >
            <td className="p-3 align-top text-ink">
              <div>{formatTanggal(sale.occurredAt)}</div>
              <div className="text-xs text-ink-muted">{formatJam(sale.occurredAt)}</div>
              <button
                type="button"
                ref={node => { if (node) buttons.current.set(sale.id, node); else buttons.current.delete(sale.id) }}
                aria-current={sale.id === activeId ? 'true' : undefined}
                onKeyDown={e => handleKeyDown(e, index)}
                onClick={e => { e.stopPropagation(); onSelect(sale.id) }}
                aria-label={`Buka detail transaksi ${shortNota(sale.id)}`}
                className="-ml-2 inline-flex min-h-control items-center px-2 text-xs font-semibold tabular-nums text-primary-ink hover:underline"
              >
                {shortNota(sale.id)}
              </button>
            </td>
            <td className="p-3 align-top text-ink-muted">{lineSummary(sale)}</td>
            <td className="p-3 text-right align-top tabular-nums text-ink">{formatRupiah(rupiah(sale.total))}</td>
            <td className="p-3 align-top text-ink-muted max-md:hidden lg:hidden">{labelMetode(sale.metodeBayar)}</td>
            {/* On a phone only a cancelled sale gets a badge: "Aktif" on every row costs width the item name needs. */}
            <td className={`p-3 align-top ${sale.status === 'aktif' ? 'max-md:p-0' : ''}`}>
              <span className={sale.status === 'aktif' ? 'max-md:hidden' : ''}><SaleStatusPill status={sale.status} /></span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * yyyy-mm-dd (a TanggalFilter value) -> the local-day boundaries occurredAt
 * (a UTC ISO string) is compared against.
 *
 * This app is Bahasa-Indonesia-only, built for a single real shop that is
 * always somewhere in Asia (UTC+7/+8/+9), and TopNav / formatTanggal.ts
 * both render dates in the browser's local timezone. Computing the filter's
 * day boundaries in UTC instead of local time made this screen's own filter
 * disagree with the dates it prints: a sale recorded at 06:30 local time
 * shows a "23 Sep" label but would silently vanish from that day's filter.
 * `new Date(`${date}T00:00:00`)` parses as local midnight in the browser,
 * so the boundaries below are built from that instead. The upper bound is
 * exclusive (next local midnight), matched by the between() call's own
 * includeUpper argument, so a sale recorded exactly at a day boundary is
 * never double-counted.
 */
function dayBounds(date: string): [string, string] {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return [start.toISOString(), end.toISOString()]
}

export function SaleList() {
  const [dateFilter, setDateFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const compact = useIsCompact()

  const sales = useLiveQuery(async () => {
    if (dateFilter === null) {
      return db.salesProj.orderBy('occurredAt').reverse().toArray()
    }
    const [start, end] = dayBounds(dateFilter)
    return db.salesProj.where('occurredAt').between(start, end, true, false).reverse().toArray()
  }, [dateFilter])

  // Cancelled sales are listed but never counted toward the day's total.
  const summary = {
    count: (sales ?? []).filter(x => x.status === 'aktif').length,
    total: (sales ?? []).filter(x => x.status === 'aktif').reduce((sum, x) => sum + x.total, 0),
    batal: (sales ?? []).filter(x => x.status === 'batal').length,
  }

  // The open nota is derived, not stored: the person's pick while it is still
  // in the list on screen, otherwise the newest sale (the list is newest
  // first). A new sale from Kasir, or a change of date, therefore lands on the
  // right nota with no effect to keep in sync. On a phone nothing opens until
  // a row is tapped.
  const known = selectedId !== null && (sales ?? []).some(x => x.id === selectedId)
  const activeId = known ? selectedId : compact ? null : (sales?.[0]?.id ?? null)

  const handleSelect = (saleId: string) => {
    setSelectedId(saleId)
    setSheetOpen(true)
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <PageHeader title="Transaksi" />

      <TanggalFilter value={dateFilter} onChange={setDateFilter} />

      {sales === undefined ? (
        <div aria-busy="true" role="status" className="rounded-card bg-surface shadow-card">
          <span className="sr-only">Memuat daftar transaksi...</span>
          <table className="w-full border-collapse">
            <tbody>
              {[0, 1, 2, 3].map(index => (
                <SkeletonRow key={index} index={index} />
              ))}
            </tbody>
          </table>
        </div>
      ) : sales.length === 0 && dateFilter === null ? (
        <EmptyState icon={ReceiptText}>Belum ada transaksi hari ini. Mulai transaksi.</EmptyState>
      ) : sales.length === 0 ? (
        <EmptyState icon={ReceiptText}>Tidak ada transaksi pada tanggal ini.</EmptyState>
      ) : (
        <>
          {/* One summary for assistive tech (this line), one for the eye (the
              tiles below, hidden from it): the same numbers, never announced twice. */}
          <p className="sr-only" data-testid="sale-summary">
            {summary.count} transaksi · {formatRupiah(rupiah(summary.total))}
            {summary.batal > 0 && ` · ${summary.batal} batal`}
          </p>
          <div aria-hidden="true" className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-3">
            <StatTile label="Transaksi" value={summary.count} icon={ReceiptText} />
            <StatTile label="Dibatalkan" value={summary.batal} icon={Ban} />
            <StatTile label="Penjualan" value={formatRupiah(rupiah(summary.total))} icon={Wallet} className="col-span-2 lg:col-span-1" />
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {!compact && activeId && (
              // Keyed on the sale so each nota enters fresh and the cancel
              // form's half-typed reason never follows you to another sale.
              <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:rounded-card">
                <SaleDetail key={activeId} saleId={activeId} />
              </div>
            )}
            <div className="overflow-x-auto rounded-card bg-surface shadow-card">
              <SaleTable rows={sales} activeId={activeId} arrowNav={!compact} onSelect={handleSelect} />
            </div>
          </div>
        </>
      )}

      {compact && (
        <Sheet open={sheetOpen && activeId !== null} onClose={() => setSheetOpen(false)} title="Detail transaksi">
          {activeId && <SaleDetail key={activeId} saleId={activeId} embedded />}
        </Sheet>
      )}
    </main>
  )
}
