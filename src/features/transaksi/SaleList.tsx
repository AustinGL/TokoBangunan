import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { Sale } from '../../domain/projections/sales'
import { formatRupiah, rupiah } from '../../domain/money'
import { TanggalFilter } from './TanggalFilter'
import { SaleDetail } from './SaleDetail'
import { formatTanggal } from './formatTanggal'

/**
 * Component breakdown table's exact row: "Transaksi list |
 * features/transaksi/SaleList.tsx | Section 7 Tables | Reads salesProj
 * sorted occurredAt desc. batal status uses neutral coloring (not danger -
 * cancellation isn't an error state)."
 *
 * Also this screen's assembly root (the same role ItemList.tsx plays for
 * /stok and Kasir.tsx plays for /kasir): hosts TanggalFilter and, per the
 * plan's Reference section naming only /stok, /kasir, /transaksi as real
 * routes, opens SaleDetail as a toggle-visible inline panel rather than a
 * /transaksi/:id route.
 */

const STATUS_LABEL: Record<Sale['status'], string> = { aktif: 'Aktif', batal: 'Batal' }
// batal is explicitly NEUTRAL, never danger: cancellation is a legitimate,
// intentional business action per the plan's own reasoning, not a failure
// state. aktif needs no special treatment (it is the normal case); success
// is used at this component's discretion, not mandated by the plan.
const STATUS_CLASS: Record<Sale['status'], string> = {
  aktif: 'bg-success-bg text-success',
  batal: 'bg-neutral-bg text-neutral',
}

function StatusPill({ status }: { status: Sale['status'] }) {
  return (
    <span className={`inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[12px] font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
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

function SaleTable({ rows, onSelect }: { rows: Sale[]; onSelect: (saleId: string) => void }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-border text-left">
          <th scope="col" className="p-3 text-[12px] font-semibold text-[var(--table-head-fg)]">Tanggal</th>
          <th scope="col" className="p-3 text-[12px] font-semibold text-[var(--table-head-fg)]">Barang</th>
          <th scope="col" className="p-3 text-right text-[12px] font-semibold text-[var(--table-head-fg)]">Total</th>
          <th scope="col" className="p-3 text-[12px] font-semibold text-[var(--table-head-fg)]">Metode</th>
          <th scope="col" className="p-3 text-[12px] font-semibold text-[var(--table-head-fg)]">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(sale => (
          <tr
            key={sale.id}
            onClick={() => onSelect(sale.id)}
            onKeyDown={e => {
              // The row opens SaleDetail on click; MASTER.md section 11's
              // Keyboard rule ("visible focus everywhere ... no traps")
              // still applies to a clickable table row, so Enter/Space
              // reaches the same handler a mouse click does. tabIndex below
              // makes the row focusable, and the app-wide :focus-visible
              // rule (src/ui/tokens.css) supplies the visible ring.
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(sale.id)
              }
            }}
            tabIndex={0}
            className="cursor-pointer border-b border-[var(--table-row-bd)] text-[14px] hover:bg-[var(--table-row-hover)]"
          >
            <td className="p-3 text-ink">{formatTanggal(sale.occurredAt)}</td>
            <td className="p-3 text-ink-muted">{lineSummary(sale)}</td>
            <td className="p-3 text-right tabular-nums text-ink">{formatRupiah(rupiah(sale.total))}</td>
            <td className="p-3 text-ink-muted">Tunai</td>
            <td className="p-3"><StatusPill status={sale.status} /></td>
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

  const sales = useLiveQuery(async () => {
    if (dateFilter === null) {
      return db.salesProj.orderBy('occurredAt').reverse().toArray()
    }
    const [start, end] = dayBounds(dateFilter)
    return db.salesProj.where('occurredAt').between(start, end, true, false).reverse().toArray()
  }, [dateFilter])

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <h1 className="text-[17px] font-bold text-ink">Transaksi</h1>

      <TanggalFilter value={dateFilter} onChange={setDateFilter} />

      {selectedId && (
        <SaleDetail saleId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {sales === undefined ? (
        <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface">
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
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Belum ada transaksi hari ini. Mulai transaksi.
        </p>
      ) : sales.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Tidak ada transaksi pada tanggal ini.
        </p>
      ) : (
        <div className="rounded-card border border-border bg-surface">
          <SaleTable rows={sales} onSelect={setSelectedId} />
        </div>
      )}
    </main>
  )
}
