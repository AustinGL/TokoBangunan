import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { voidSale } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { formatRupiah, rupiah } from '../../domain/money'
import { fromBase, qty } from '../../domain/quantity'
import { formatTanggal } from '../shared/formatTanggal'

/**
 * Component breakdown table's exact row: "Sale detail |
 * features/transaksi/SaleDetail.tsx | Section 7, 9 | Cetak nota (browser
 * print), Batalkan (confirm, then commands.voidSale)."
 *
 * Owns its own live query over salesProj (keyed by saleId, not a prop
 * passed down from SaleList's own list query) so it is self-contained and
 * testable in isolation, and so a void's status flip is reflected the
 * moment the projection write lands, with no manual refetch.
 */

type Props = {
  saleId: string
  onClose?: () => void
}

const STATUS_LABEL = { aktif: 'Aktif', batal: 'Batal' } as const
// batal is neutral, never danger: the same rule SaleList's own StatusPill
// enforces. Cancellation is a legitimate, intentional business action, not
// a failure state.
const STATUS_CLASS = {
  aktif: 'bg-success-bg text-success',
  batal: 'bg-neutral-bg text-neutral',
} as const

function StatusPill({ status }: { status: 'aktif' | 'batal' }) {
  return (
    <span
      data-testid="sale-status"
      className={`inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[12px] font-semibold ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function SaleDetail({ saleId, onClose }: Props) {
  const sale = useLiveQuery(() => db.salesProj.get(saleId), [saleId])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [alasanError, setAlasanError] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)
  const voidErrorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (voidError) voidErrorRef.current?.focus()
  }, [voidError])

  if (sale === undefined) {
    return (
      <section aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6">
        <span className="sr-only">Memuat transaksi...</span>
      </section>
    )
  }

  const handleCetak = () => {
    window.print()
  }

  const handleBatalkanClick = () => {
    setConfirmOpen(true)
    setVoidError(null)
  }

  const handleCancelConfirm = () => {
    setConfirmOpen(false)
    setAlasan('')
    setAlasanError(null)
  }

  const handleVoidSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (alasan.trim() === '') {
      setAlasanError('Alasan pembatalan wajib diisi.')
      return
    }
    setAlasanError(null)
    setVoidError(null)
    setVoiding(true)
    try {
      await voidSale(saleId, alasan.trim(), { clock: systemClock, deviceId: getDeviceId() })
      // No manual status update here: the useLiveQuery subscription above
      // picks up the SaleVoided write's projection effect on its own, and
      // the effect above closes the confirm area once sale.status flips.
    } catch {
      // Both of voidSale's thrown guard errors ("not found", "already
      // batal") land here, along with any real IndexedDB write failure.
      // Same visible, focusable error pattern ItemForm.tsx and
      // CartPanel.tsx already established: never a silent failure, and the
      // sale's rendered status never changes on a rejected call.
      setVoidError('Transaksi gagal dibatalkan. Coba lagi.')
    } finally {
      setVoiding(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6 shadow-card">
      {/* Scoped print stylesheet: only .printable-nota (and its
          descendants) stays visible when printing, everything else on the
          page (nav, filters, this section's own buttons) is hidden. This
          is "ship browser print with a print stylesheet first" per the
          architecture doc, section 10 - no PDF library, no print service. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-nota, .printable-nota * { visibility: visible; }
          .printable-nota { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-bold text-ink">Detail transaksi</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-tap rounded-tile px-3 text-[13px] font-medium text-ink-muted"
          >
            Tutup
          </button>
        )}
      </div>

      <div className="printable-nota flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[13px] text-ink-muted">{formatTanggal(sale.occurredAt)}</p>
          </div>
          <StatusPill status={sale.status} />
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-2 text-[12px] font-semibold text-[var(--table-head-fg)]">Nama</th>
              <th scope="col" className="p-2 text-right text-[12px] font-semibold text-[var(--table-head-fg)]">Jumlah</th>
              <th scope="col" className="p-2 text-right text-[12px] font-semibold text-[var(--table-head-fg)]">Harga satuan</th>
              <th scope="col" className="p-2 text-right text-[12px] font-semibold text-[var(--table-head-fg)]">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map(line => (
              <tr key={line.itemId} className="border-b border-[var(--table-row-bd)] text-[14px]">
                <td className="p-2 text-ink">{line.nama}</td>
                {/* Phase 2 sale lines always use the item's baseUnit (factor 1),
                    but fromBase is used regardless, the same milli-to-whole
                    conversion path every other quantity display in this
                    codebase goes through, rather than hand-written division. */}
                <td className="p-2 text-right tabular-nums text-ink">{fromBase(qty(line.qty), { unit: line.unit, factor: 1 })} {line.unit}</td>
                <td className="p-2 text-right tabular-nums text-ink">{formatRupiah(rupiah(line.hargaSatuan))}</td>
                <td className="p-2 text-right tabular-nums text-ink">{formatRupiah(rupiah(line.subtotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col gap-1 border-t border-dashed border-border-strong pt-3 text-[14px]">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatRupiah(rupiah(sale.subtotal))}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Diskon</span>
            <span className="tabular-nums">{formatRupiah(rupiah(sale.diskon))}</span>
          </div>
          <div className="flex items-center justify-between text-[16px] font-bold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(rupiah(sale.total))}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Metode bayar</span>
            <span>Tunai</span>
          </div>
          {sale.uangDiterima !== undefined && (
            <div className="flex items-center justify-between text-ink-muted">
              <span>Uang diterima</span>
              <span className="tabular-nums">{formatRupiah(rupiah(sale.uangDiterima))}</span>
            </div>
          )}
          {sale.uangDiterima !== undefined && (
            <div className="flex items-center justify-between text-ink-muted">
              <span>Kembalian</span>
              <span className="tabular-nums">{formatRupiah(rupiah(sale.uangDiterima - sale.total))}</span>
            </div>
          )}
        </div>

        {sale.status === 'batal' && (
          <div className="rounded-field bg-neutral-bg p-3 text-[13px] text-neutral">
            <p>Dibatalkan pada {sale.voidedAt ? formatTanggal(sale.voidedAt) : '-'}</p>
            {sale.voidedReason && <p>Alasan: {sale.voidedReason}</p>}
          </div>
        )}
      </div>

      <div className="no-print flex flex-col gap-3">
        <button
          type="button"
          onClick={handleCetak}
          className="min-h-tap w-fit rounded-tile border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)]"
        >
          Cetak nota
        </button>

        {voidError && (
          <div
            ref={voidErrorRef}
            role="alert"
            tabIndex={-1}
            className="rounded-field border border-danger bg-danger-bg p-3 text-[13px] font-semibold text-danger focus-visible:outline-none"
          >
            {voidError}
          </div>
        )}

        {sale.status === 'aktif' && !confirmOpen && (
          <button
            type="button"
            onClick={handleBatalkanClick}
            className="min-h-tap w-fit rounded-tile border border-danger px-4 text-[14px] font-semibold text-danger"
          >
            Batalkan
          </button>
        )}

        {sale.status === 'aktif' && confirmOpen && (
          <form onSubmit={handleVoidSubmit} noValidate className="flex flex-col gap-2 rounded-field border border-border-input bg-surface-sunken p-4">
            <p className="text-[13px] font-semibold text-ink">Batalkan transaksi ini?</p>
            <div className="flex flex-col gap-1">
              <label htmlFor="sale-void-alasan" className="text-[13px] font-medium text-ink">
                Alasan pembatalan<span aria-hidden="true"> *</span>
              </label>
              <input
                id="sale-void-alasan"
                type="text"
                value={alasan}
                onChange={e => setAlasan(e.target.value)}
                aria-invalid={alasanError ? true : undefined}
                aria-describedby={alasanError ? 'sale-void-alasan-error' : undefined}
                className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${
                  alasanError ? 'border-danger' : 'border-[var(--field-bd)]'
                }`}
              />
              {alasanError && (
                <p id="sale-void-alasan-error" className="text-[13px] text-danger">
                  {alasanError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="min-h-tap rounded-tile px-4 text-[14px] font-medium text-ink-muted"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={voiding}
                className="min-h-tap rounded-field bg-danger px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:opacity-70"
              >
                {voiding ? 'Membatalkan...' : 'Ya, batalkan'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
