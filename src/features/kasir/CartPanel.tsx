import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { fromBase, qty } from '../../domain/quantity'
import { formatRupiah, rupiah, subtract, type Rupiah } from '../../domain/money'
import { recordSale, type RecordSaleInput } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import type { CartLine, UseCartResult } from './useCart'

/**
 * MASTER.md section 8's Cart panel spec, narrowed for Phase 2 by Decisions
 * 2/3/4/6 (see task-6b-brief.md for the verbatim quotes this file
 * implements): multi-satuan conversion lines, price-tier reasoning and
 * manual-override flags do not exist yet (sale lines only use baseUnit this
 * phase), so a cart line here only ever shows name, unit price, qty
 * stepper and subtotal. Payment methods other than Tunai, the Kirim
 * delivery option, the customer picker and Diskon entry all render but are
 * permanently inert (real `disabled`, never CSS-only), and "Simpan
 * sementara" is omitted entirely (Decision 3).
 */

type Props = {
  cart: UseCartResult
  /**
   * Called after a successful "Simpan & buat baru" save (not after a plain
   * "Simpan transaksi"), so the screen-assembly root can refocus search for
   * the next sale. The spec's own words for that button are "for batch
   * runs"; "Simpan transaksi" has no such follow-up need.
   */
  onSaveAndNew?: () => void
}

const TOAST_DURATION_MS = 3000

function stockWarningFor(line: CartLine, stockRows: { itemId: string; quantity: number }[] | undefined): string | undefined {
  // stockRows === undefined means the live query has not resolved yet: no
  // warning is shown until there is real data to compare against, rather
  // than a false positive against zero. Once resolved, a missing row means
  // the item has never had a stock movement, which is genuinely 0 stock
  // (same convention useProductCatalog.ts already uses for the same gap).
  if (stockRows === undefined) return undefined
  const row = stockRows.find(r => r.itemId === line.itemId)
  const milliQty = row?.quantity ?? 0
  const stockWhole = fromBase(qty(milliQty), { unit: line.unit, factor: 1 })
  if (line.qtyWhole <= stockWhole) return undefined
  // D7 / flow section 10's worked example: "Stok semen tinggal 3 sak.
  // Lanjutkan?" This is the same phrasing adapted per item/quantity, still
  // just a warning: it never blocks "Simpan transaksi".
  return `Stok ${line.nama} tinggal ${stockWhole} ${line.unit}. Lanjutkan?`
}

function QtyStepper({ line, onChange }: { line: CartLine; onChange: (qtyWhole: number) => void }) {
  const inputId = `kasir-qty-${line.itemId}`
  // The input's own text, decoupled from line.qtyWhole while the owner is
  // mid-edit. Without this, clearing the field to type "40" would fire a
  // change event with value === '', which read as qtyWhole 0 would call
  // useCart's setQtyWhole(id, 0) and remove the line before the next digit
  // ever lands (useCart's own documented "qtyWhole <= 0 removes the line"
  // convention, correct for a deliberate clear, wrong for a mid-keystroke
  // empty string). Judgment call, noted in the report.
  const [draft, setDraft] = useState(String(line.qtyWhole))
  // "Adjusting state when a prop changes", done during render rather than
  // in an effect (React's own recommended pattern for this): tracks the
  // last qtyWhole this component has rendered for, and resyncs draft only
  // when the committed quantity actually moved out from under it (the +/-
  // buttons, or another line reusing this component). A committed change
  // that matches what the user just typed leaves draft untouched, and a
  // momentarily empty draft (mid-clear, qtyWhole not yet committed) is never
  // stomped either, since qtyWhole has not changed in that case.
  const [lastQtyWhole, setLastQtyWhole] = useState(line.qtyWhole)
  if (line.qtyWhole !== lastQtyWhole) {
    setLastQtyWhole(line.qtyWhole)
    setDraft(String(line.qtyWhole))
  }

  const handleChange = (raw: string) => {
    setDraft(raw)
    if (raw === '') return
    const n = Number(raw)
    if (Number.isFinite(n)) onChange(n)
  }

  const handleBlur = () => {
    // Leaving the field empty is treated as a deliberate clear, same as
    // typing 0: it removes the line, per useCart's existing convention.
    if (draft === '') onChange(0)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Kurangi jumlah"
        onClick={() => onChange(line.qtyWhole - 1)}
        className="flex min-h-tap min-w-tap items-center justify-center rounded-tile border border-border-input text-[16px] font-bold text-ink"
      >
        -
      </button>
      <div className="flex flex-col items-center gap-0.5">
        {/* Visible label text ("Jumlah"), MASTER.md section 8: "an input
            type=number with a visible label, so 40 sak can be typed rather
            than tapped forty times." The item name is included as
            screen-reader-only text so each line's accessible name stays
            unique without visually repeating it on every row. */}
        <label htmlFor={inputId} className="text-[11px] font-medium text-ink-faint">
          Jumlah<span className="sr-only"> {line.nama}</span>
        </label>
        <input
          id={inputId}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={draft}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
          className="h-[var(--field-h)] w-16 rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-2 text-center text-[14px] text-ink"
        />
      </div>
      <button
        type="button"
        aria-label="Tambah jumlah"
        onClick={() => onChange(line.qtyWhole + 1)}
        className="flex min-h-tap min-w-tap items-center justify-center rounded-tile border border-border-input text-[16px] font-bold text-ink"
      >
        +
      </button>
    </div>
  )
}

function CartLineRow({
  line, onQtyChange, stockRows,
}: {
  line: CartLine
  onQtyChange: (itemId: string, qtyWhole: number) => void
  stockRows: { itemId: string; quantity: number }[] | undefined
}) {
  const warning = stockWarningFor(line, stockRows)
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-ink">{line.nama}</p>
          <p className="text-[12px] text-ink-faint">
            {formatRupiah(rupiah(line.hargaSatuan))} / {line.unit}
          </p>
        </div>
        <p className="text-[15px] font-bold tabular-nums text-ink">{formatRupiah(rupiah(line.subtotal))}</p>
      </div>
      <QtyStepper line={line} onChange={qtyWhole => onQtyChange(line.itemId, qtyWhole)} />
      {warning && (
        <p className="text-[13px] font-medium text-warning">{warning}</p>
      )}
    </li>
  )
}

/** Real, permanently-disabled radio options: Decision 2, forward-compatible with Phase 4. */
function PaymentMethodPills() {
  const options: { value: string; label: string; disabled: boolean }[] = [
    { value: 'tunai', label: 'Tunai', disabled: false },
    { value: 'transfer', label: 'Transfer', disabled: true },
    { value: 'qris', label: 'QRIS', disabled: true },
    { value: 'bon', label: 'Bon', disabled: true },
  ]
  return (
    <div role="radiogroup" aria-label="Metode pembayaran" className="flex flex-wrap gap-2">
      {options.map(option => {
        const checked = option.value === 'tunai'
        return (
          <label
            key={option.value}
            className={`min-h-tap inline-flex items-center rounded-[var(--r-pill)] border px-4 text-[13px] font-medium ${
              checked
                ? 'border-transparent bg-mint-soft text-primary'
                : 'border-border-input bg-surface text-ink-disabled'
            } ${option.disabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <input
              type="radio"
              name="kasir-metode-bayar"
              value={option.value}
              checked={checked}
              disabled={option.disabled}
              onChange={() => {}}
              className="sr-only"
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

/** Dibawa enabled and permanent, Kirim really-disabled (Decision 4). */
function DeliveryToggle() {
  const options = [
    { value: 'dibawa', label: 'Dibawa sekarang', disabled: false },
    { value: 'kirim', label: 'Kirim', disabled: true },
  ]
  return (
    <div role="radiogroup" aria-label="Pengiriman" className="flex flex-wrap gap-2">
      {options.map(option => {
        const checked = option.value === 'dibawa'
        return (
          <label
            key={option.value}
            className={`min-h-tap inline-flex items-center rounded-[var(--r-pill)] border px-4 text-[13px] font-medium ${
              checked
                ? 'border-transparent bg-mint-soft text-primary'
                : 'border-border-input bg-surface text-ink-disabled'
            } ${option.disabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <input
              type="radio"
              name="kasir-pengiriman"
              value={option.value}
              checked={checked}
              disabled={option.disabled}
              onChange={() => {}}
              className="sr-only"
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

export function CartPanel({ cart, onSaveAndNew }: Props) {
  const { lines, subtotal } = cart
  const [uangDiterima, setUangDiterima] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Live stock, queried here rather than in useCart (Task 6a's useCart is
  // deliberately stock-unaware) or in Kasir.tsx (the brief asks for this
  // comparison inside CartPanel itself). Queried with stable (empty) deps
  // over the whole table, the same shape useProductCatalog.ts already uses,
  // rather than a query keyed on the cart's item ids: keying the query on
  // the cart contents would make it re-subscribe every time a line is added
  // or removed, and dexie-react-hooks keeps serving the previous (now
  // mismatched) result while the new subscription's first emission is still
  // in flight, which briefly compares a freshly-added line against stock
  // data for a completely different query. A stable subscription over the
  // full table sidesteps that gap entirely, and only ever grows to the
  // size of the stok table, which is already read whole elsewhere
  // (useProductCatalog, useStokList).
  const stockRows = useLiveQuery(() => db.stokProj.toArray(), [])

  useEffect(() => {
    if (saveError) errorRef.current?.focus()
  }, [saveError])

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
  }, [])

  const diskon: Rupiah = rupiah(0)
  const total = subtract(rupiah(subtotal), diskon)

  const uangDiterimaTrimmed = uangDiterima.trim()
  const uangDiterimaValue =
    uangDiterimaTrimmed === '' || !Number.isInteger(Number(uangDiterimaTrimmed))
      ? undefined
      : Number(uangDiterimaTrimmed)
  const kembalian = uangDiterimaValue === undefined ? undefined : subtract(rupiah(uangDiterimaValue), total)

  const showToast = () => {
    setToastVisible(true)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToastVisible(false), TOAST_DURATION_MS)
  }

  const handleQtyChange = (itemId: string, qtyWhole: number) => {
    cart.setQtyWhole(itemId, qtyWhole)
  }

  const handleSave = async (andNew: boolean) => {
    setSaveError(null)
    setSaving(true)
    try {
      const input: RecordSaleInput = {
        lines: lines.map(line => ({
          itemId: line.itemId,
          nama: line.nama,
          unit: line.unit,
          qty: line.qty,
          hargaSatuan: line.hargaSatuan,
          subtotal: line.subtotal,
        })),
        metodeBayar: 'tunai',
        uangDiterima: uangDiterimaValue,
        customerId: undefined,
      }
      await recordSale(input, { clock: systemClock, deviceId: getDeviceId() })
      cart.clear()
      setUangDiterima('')
      showToast()
      if (andNew) onSaveAndNew?.()
    } catch {
      // Same visible, focusable error pattern ItemForm.tsx already
      // established for a rejected IndexedDB write: never a silent failure,
      // and the cart is left intact so nothing entered is lost.
      setSaveError('Transaksi gagal disimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled = lines.length === 0 || saving

  return (
    <div className="flex h-full flex-col rounded-card border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <h2 className="text-[15px] font-bold text-ink">Keranjang</h2>
        <span className="inline-flex min-h-[24px] items-center rounded-[var(--r-pill)] bg-mint-soft px-[10px] text-[12px] font-semibold text-primary">
          {lines.length}
        </span>
      </div>

      {toastVisible && (
        <div role="status" aria-live="polite" className="mx-4 mt-3 rounded-field bg-success-bg px-4 py-2 text-[13px] font-medium text-success">
          Transaksi tersimpan
        </div>
      )}

      {saveError && (
        <div
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="mx-4 mt-3 rounded-field border border-danger bg-danger-bg p-3 text-[13px] font-semibold text-danger focus-visible:outline-none"
        >
          {saveError}
        </div>
      )}

      <ul className="scroll-region flex-1 overflow-y-auto px-4">
        {lines.length === 0 ? (
          <li className="py-8 text-center text-[14px] text-ink-muted">
            Keranjang kosong. Tambahkan barang untuk mulai.
          </li>
        ) : (
          lines.map(line => (
            <CartLineRow key={line.itemId} line={line} onQtyChange={handleQtyChange} stockRows={stockRows} />
          ))
        )}
      </ul>

      <div className="sticky bottom-0 z-sticky flex flex-col gap-3 rounded-b-card border-t border-border bg-surface-sunken p-4">
        <div className="flex items-center justify-between text-[14px] text-ink-muted">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatRupiah(rupiah(subtotal))}</span>
        </div>
        <div className="flex items-center justify-between text-[14px] text-danger">
          <span>Diskon</span>
          <span className="tabular-nums">{formatRupiah(diskon)}</span>
        </div>
        <div
          data-testid="kasir-total"
          aria-live="polite"
          role="status"
          className="flex items-center justify-between border-t border-dashed border-border-strong pt-3"
        >
          <span className="text-[14px] font-semibold text-ink">Total</span>
          <span className="text-[26px] font-extrabold tabular-nums text-ink">{formatRupiah(total)}</span>
        </div>

        <PaymentMethodPills />

        <div className="flex flex-col gap-1">
          <label htmlFor="kasir-uang-diterima" className="text-[13px] font-medium text-ink">
            Uang diterima
          </label>
          <input
            id="kasir-uang-diterima"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={uangDiterima}
            onChange={e => setUangDiterima(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          />
          {kembalian !== undefined && (
            <p className={`text-[13px] font-medium ${kembalian < 0 ? 'text-danger' : 'text-ink-muted'}`}>
              Kembalian: {formatRupiah(kembalian)}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-[14px]">
          <span className="text-ink-muted">Pelanggan</span>
          <span className="font-medium text-ink">Tanpa pelanggan</span>
        </div>

        <DeliveryToggle />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saveDisabled}
            className="min-h-tap flex-1 rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)] disabled:cursor-not-allowed disabled:text-ink-disabled"
          >
            Simpan &amp; buat baru
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saveDisabled}
            className="min-h-tap flex-1 rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:cursor-not-allowed disabled:text-ink-disabled"
          >
            Simpan transaksi
          </button>
        </div>
      </div>
    </div>
  )
}
