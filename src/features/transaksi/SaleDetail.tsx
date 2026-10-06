import { useEffect, useRef, useState, type FormEvent } from 'react'
import { labelMetode } from './labelMetode'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { voidSale, PembatalanDitolakError } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { formatRupiah, rupiah } from '../../domain/money'
import { fromBase, qty } from '../../domain/quantity'
import { formatTanggal, formatTanggalKey, formatJam } from '../shared/formatTanggal'
import { shortNota } from '../../domain/nota'
import { sisaNota } from '../../domain/piutang'
import { StatusPill } from '../../ui/StatusPill'
import { Button } from '../../ui/Button'

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
  /**
   * Rendered inside a host that already supplies the card, title and close
   * button (the phone's bottom Sheet): drops this component's own wrapper.
   */
  embedded?: boolean
}

function SaleStatusPill({ status }: { status: 'aktif' | 'batal' }) {
  // batal is neutral, never danger: cancellation is a legitimate, intentional
  // business action, not a failure state.
  return (
    <span data-testid="sale-status">
      <StatusPill tone={status === 'aktif' ? 'success' : 'neutral'}>{status === 'aktif' ? 'Aktif' : 'Batal'}</StatusPill>
    </span>
  )
}

export function SaleDetail({ saleId, onClose, embedded = false }: Props) {
  const sale = useLiveQuery(() => db.salesProj.get(saleId), [saleId])
  const payments = useLiveQuery(() => db.paymentsProj.where('saleId').equals(saleId).toArray(), [saleId])
  const customerId = sale?.customerId
  // Only reachable when another device cancelled the nota before it saw a payment (voidSale refuses it locally).
  const diterimaSetelahBatal = (payments ?? []).reduce((sum, p) => sum + p.jumlah, 0)
  // null = still loading, undefined = no such customer row on this device; the
  // two must not look alike, or the name flashes "tidak dikenal" on every open.
  const customer = useLiveQuery(async () => (customerId ? db.customersProj.get(customerId) : undefined), [customerId], null)

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
      <section aria-busy="true" role="status" className="skeleton h-48 rounded-card">
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
    } catch (error) {
      // Both of voidSale's thrown guard errors ("not found", "already
      // batal") land here, along with any real IndexedDB write failure.
      // Same visible, focusable error pattern ItemForm.tsx and
      // CartPanel.tsx already established: never a silent failure, and the
      // sale's rendered status never changes on a rejected call.
      // A refusal for a business reason (a payment already exists) carries its
      // own, owner-readable message; anything else is a write failure.
      setVoidError(error instanceof PembatalanDitolakError ? error.message : 'Transaksi gagal dibatalkan. Coba lagi.')
    } finally {
      setVoiding(false)
    }
  }

  return (
    <section className={embedded ? 'flex flex-col gap-4' : 'card-in flex flex-col gap-4 rounded-card bg-surface p-6 shadow-card'}>
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

      <div className={`no-print flex items-center justify-between gap-4 ${embedded ? 'hidden' : ''}`}>
        <h2 className="text-lg font-semibold text-ink">Detail transaksi</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Tutup
          </Button>
        )}
      </div>

      <div className="printable-nota flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-bold tabular-nums text-ink">{shortNota(sale.id)}</p>
            <p className="text-sm text-ink-muted">{formatTanggal(sale.occurredAt)} · {formatJam(sale.occurredAt)}</p>
          </div>
          <SaleStatusPill status={sale.status} />
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-separator text-left">
              <th scope="col" className="p-2 text-xs font-semibold text-[var(--table-head-fg)]">Nama</th>
              <th scope="col" className="p-2 text-right text-xs font-semibold text-[var(--table-head-fg)]">Jumlah</th>
              <th scope="col" className="p-2 text-right text-xs font-semibold text-[var(--table-head-fg)]">Harga satuan</th>
              <th scope="col" className="p-2 text-right text-xs font-semibold text-[var(--table-head-fg)]">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map(line => (
              <tr key={line.itemId} className="border-b border-[var(--table-row-bd)] text-sm">
                <td className="p-2 text-ink">{line.nama}</td>
                {/* Phase 2 sale lines always use the item's baseUnit (factor 1),
                    but fromBase is used regardless, the same milli-to-whole
                    conversion path every other quantity display in this
                    codebase goes through, rather than hand-written division. */}
                <td className="p-2 text-right tabular-nums text-ink">{/* "3 × 50 kg", never "3 50 kg": a bare quantity next to a unit that itself starts with a number reads as 350 kg. */}
                  {fromBase(qty(line.qty), { unit: line.unit, factor: 1 })} × {line.unit}
                </td>
                <td className="p-2 text-right tabular-nums text-ink">{formatRupiah(rupiah(line.hargaSatuan))}</td>
                <td className="p-2 text-right tabular-nums text-ink">{formatRupiah(rupiah(line.subtotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col gap-1 border-t border-dashed border-border-strong pt-3 text-sm">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatRupiah(rupiah(sale.subtotal))}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Diskon</span>
            <span className="tabular-nums">{formatRupiah(rupiah(sale.diskon))}</span>
          </div>
          <div className="flex items-center justify-between text-base font-bold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatRupiah(rupiah(sale.total))}</span>
          </div>
          <div className="flex items-center justify-between text-ink-muted">
            <span>Metode bayar</span>
            <span>{labelMetode(sale.metodeBayar)}</span>
          </div>
          {sale.metodeBayar === 'bon' && (
            <div data-testid="sale-bon" className="mt-1 flex flex-col gap-1 rounded-field bg-fill-tertiary p-3">
              <div className="flex items-center justify-between text-ink-muted">
                <span>Pelanggan</span>
                <span className="font-medium text-ink">{customer === null ? '' : customer?.nama ?? 'Pelanggan tidak dikenal'}</span>
              </div>
              {sale.jatuhTempo && (
                <div className="flex items-center justify-between text-ink-muted">
                  <span>Jatuh tempo</span>
                  <span className="text-ink">{formatTanggalKey(sale.jatuhTempo)}</span>
                </div>
              )}
              {(sale.dibayarAwal ?? 0) > 0 && (
                <div className="flex items-center justify-between text-ink-muted">
                  <span>Dibayar saat transaksi</span>
                  <span className="tabular-nums text-ink">{formatRupiah(rupiah(sale.dibayarAwal ?? 0))}</span>
                </div>
              )}
              {(payments ?? []).map(p => (
                <div key={p.id} className="flex items-center justify-between text-ink-muted">
                  <span>Pembayaran {formatTanggal(p.occurredAt)}{p.catatan ? ` · ${p.catatan}` : ''}</span>
                  <span className="tabular-nums text-ink">{formatRupiah(rupiah(p.jumlah))}</span>
                </div>
              ))}
              {sale.status === 'aktif' && (
                <div className="flex items-center justify-between font-semibold text-ink">
                  <span>Sisa piutang</span>
                  <span className="tabular-nums">{formatRupiah(rupiah(sisaNota(sale, payments ?? [])))}</span>
                </div>
              )}
              {sale.status === 'batal' && diterimaSetelahBatal > 0 && (
                <p role="status" className="text-sm font-semibold text-warning">
                  Pembayaran {formatRupiah(rupiah(diterimaSetelahBatal))} sudah diterima untuk transaksi yang dibatalkan. Cek apakah uangnya perlu dikembalikan.
                </p>
              )}
            </div>
          )}
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
          <div className="rounded-field bg-neutral-bg p-3 text-sm text-neutral">
            <p>Dibatalkan pada {sale.voidedAt ? formatTanggal(sale.voidedAt) : '-'}</p>
            {sale.voidedReason && <p>Alasan: {sale.voidedReason}</p>}
          </div>
        )}
      </div>

      <div className="no-print flex flex-col gap-3">
        <Button variant="secondary" onClick={handleCetak} className="self-start">
          Cetak nota
        </Button>

        {voidError && (
          <div
            ref={voidErrorRef}
            role="alert"
            tabIndex={-1}
            className="rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger focus-visible:outline-none"
          >
            {voidError}
          </div>
        )}

        {sale.status === 'aktif' && !confirmOpen && (
          <Button variant="danger" onClick={handleBatalkanClick} className="self-start">
            Batalkan
          </Button>
        )}

        {sale.status === 'aktif' && confirmOpen && (
          <form onSubmit={handleVoidSubmit} noValidate className="card-in flex flex-col gap-2 rounded-card bg-fill-tertiary p-4">
            <p className="text-sm font-semibold text-ink">Batalkan transaksi ini?</p>
            <div className="flex flex-col gap-1">
              <label htmlFor="sale-void-alasan" className="text-sm font-medium text-ink">
                Alasan pembatalan<span aria-hidden="true"> *</span>
              </label>
              <input
                id="sale-void-alasan"
                type="text"
                value={alasan}
                onChange={e => setAlasan(e.target.value)}
                aria-invalid={alasanError ? true : undefined}
                aria-describedby={alasanError ? 'sale-void-alasan-error' : undefined}
                className={`h-control rounded-field border bg-[var(--field-bg)] px-3 text-base text-ink md:text-sm ${
                  alasanError ? 'border-danger' : 'border-[var(--field-bd)]'
                }`}
              />
              {alasanError && (
                <p id="sale-void-alasan-error" className="text-sm text-danger">
                  {alasanError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleCancelConfirm}>
                Batal
              </Button>
              <Button type="submit" variant="danger" disabled={voiding}>
                {voiding ? 'Membatalkan...' : 'Ya, batalkan'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
