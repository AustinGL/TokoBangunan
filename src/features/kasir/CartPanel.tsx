// src/features/kasir/CartPanel.tsx
import { useEffect, useRef, useState } from 'react'
import { Pencil, ChevronDown } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { fromBase, qty } from '../../domain/quantity'
import { formatRupiah, rupiah, subtract, type Rupiah } from '../../domain/money'
import { recordSale, type RecordSaleInput } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { useBatches } from '../shared/useBatches'
import { useSuppliers } from '../shared/useSuppliers'
import { formatTanggal } from '../shared/formatTanggal'
import { legacyRemainder, availableForLine, planSplit, type CartLineLike } from '../../domain/batchPick'
import type { Supplier } from '../../domain/projections/suppliers'
import type { CartLine, UseCartResult, SplitLineInput } from './useCart'

/**
 * MASTER.md section 8's Cart panel spec, narrowed by Decisions 2/3/4/6:
 * payment methods other than Tunai, the Kirim delivery option, the
 * customer picker and Diskon entry all render but are permanently inert
 * (real disabled, never CSS-only), and "Simpan sementara" is omitted
 * entirely. Task 10's own E1 scope adds batch-awareness and a manual-price
 * edit to what was, until now, a name/qty/subtotal-only line.
 */

type Props = {
  cart: UseCartResult
  onSaveAndNew?: () => void
}

const TOAST_DURATION_MS = 3000

function lineKeySuffix(line: CartLine): string {
  return line.batchId === undefined ? 'Stok lama' : `batch ${line.batchId}`
}

function stockWarningFor(line: CartLine, stockRows: { itemId: string; quantity: number }[] | undefined): string | undefined {
  if (stockRows === undefined) return undefined
  const row = stockRows.find(r => r.itemId === line.itemId)
  const milliQty = row?.quantity ?? 0
  const stockWhole = fromBase(qty(milliQty), { unit: line.unit, factor: 1 })
  if (line.qtyWhole <= stockWhole) return undefined
  return `Stok ${line.nama} tinggal ${stockWhole} ${line.unit}. Lanjutkan?`
}

function QtyStepper({ line, onChange }: { line: CartLine; onChange: (qtyWhole: number) => void }) {
  const inputId = `kasir-qty-${line.itemId}-${line.batchId ?? 'legacy'}`
  const [draft, setDraft] = useState(String(line.qtyWhole))
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
        <label htmlFor={inputId} className="text-[12px] font-medium text-ink-faint">
          Jumlah<span className="sr-only"> {line.nama} ({lineKeySuffix(line)})</span>
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

function PriceEdit({ line, onChange }: { line: CartLine; onChange: (value: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(line.hargaSatuan === null ? '' : String(line.hargaSatuan))
  const inputId = `kasir-harga-${line.itemId}-${line.batchId ?? 'legacy'}`
  const diubah = line.hargaSatuan !== null && line.hargaSatuan !== line.hargaNormal

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(line.hargaSatuan === null ? '' : String(line.hargaSatuan)); setEditing(true) }}
        aria-label={`Ubah harga ${line.nama}`}
        className="flex min-h-tap min-w-tap items-center gap-1 text-[12px] tabular-nums text-ink-faint"
      >
        {line.hargaSatuan === null ? 'Isi harga' : `${formatRupiah(rupiah(line.hargaSatuan))} / ${line.unit}`}
        <Pencil aria-hidden="true" size={12} />
        {diubah && (
          <span className="text-warning">(diubah, normal {formatRupiah(rupiah(line.hargaNormal))})</span>
        )}
      </button>
    )
  }

  const commit = () => {
    const digits = draft.replace(/\D/g, '')
    onChange(digits === '' ? null : Number(digits))
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={inputId} className="sr-only">Harga {line.nama}</label>
      <input
        id={inputId}
        inputMode="numeric"
        autoFocus
        value={draft}
        onFocus={e => e.target.select()}
        onMouseDown={e => e.preventDefault()}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        className="h-[var(--field-h)] w-28 rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-2 text-[13px] text-ink"
      />
    </div>
  )
}

function BatchChip({
  line, otherLines, itemHargaEceran, suppliers, onChangeBatch, onSplit,
}: {
  line: CartLine
  otherLines: CartLineLike[]
  itemHargaEceran: number
  suppliers: Supplier[] | undefined
  onChangeBatch: (toBatchId: string | undefined, hargaNormal: number) => void
  onSplit: (splits: SplitLineInput[]) => void
}) {
  const batches = useBatches(line.itemId)
  // A row-not-found result (db.stokProj.get resolves to undefined when the
  // item has no stok row yet) and "the query hasn't completed its first run
  // yet" are both `undefined` by default, so a plain `undefined` check can't
  // tell them apart. The explicit `null` default below disambiguates: only
  // `null` means "still loading."
  const stockRow = useLiveQuery(() => db.stokProj.get(line.itemId), [line.itemId], null)
  const [expanded, setExpanded] = useState(false)

  if (batches === undefined || stockRow === null) return null

  const wholeOf = (milli: number) => fromBase(qty(milli), { unit: line.unit, factor: 1 })
  const supplierNama = (id?: string) => suppliers?.find(s => s.id === id)?.nama ?? 'Tanpa supplier'

  const legacyAvailableRaw = legacyRemainder(stockRow?.quantity ?? 0, batches, line.itemId)
  const legacyClaimed = otherLines.filter(l => l.itemId === line.itemId && l.batchId === undefined).reduce((sum, l) => sum + l.qty, 0)
  const legacyAvailable = legacyAvailableRaw - legacyClaimed

  const currentBatch = batches.find(b => b.batchId === line.batchId)
  const label = line.batchId === undefined
    ? `Stok lama · sisa ${Math.max(0, wholeOf(legacyAvailable))}`
    : currentBatch
      ? `${formatTanggal(currentBatch.tanggalBeli)} · ${supplierNama(currentBatch.supplierId)} · sisa ${wholeOf(currentBatch.sisa)}`
      : 'Batch tidak ditemukan'

  const available = line.batchId === undefined ? legacyAvailable : (currentBatch ? availableForLine(currentBatch, otherLines) : 0)
  const shortfall = line.qty - available
  const overSisa = shortfall > 0

  const handleSplit = () => {
    const plan = planSplit(line.itemId, line.qty, batches, otherLines)
    if (plan.length === 0) return
    const splits: SplitLineInput[] = plan.map(p => ({
      batchId: p.batchId,
      qtyWhole: wholeOf(p.qty),
      hargaNormal: batches.find(b => b.batchId === p.batchId)?.hargaJual ?? itemHargaEceran,
    }))
    onSplit(splits)
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-label={`Ubah batch untuk ${line.nama}, saat ini ${label}`}
        className="flex min-h-tap items-center gap-1 text-[12px] text-ink-faint"
      >
        {label}
        <ChevronDown aria-hidden="true" size={14} />
      </button>

      {overSisa && (
        // Plain, non-alert markup - same convention stockWarningFor's own
        // "quantity exceeds what's available" warning already uses just
        // below (a <p>, no role="alert"): this is a proactive nudge, not a
        // blocking error, and a role="alert" here would collide with (and
        // make ambiguous) CartPanel's own save-error alert whenever both are
        // visible at once.
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-warning">
          <span>Ambil {wholeOf(shortfall)} {line.unit} dari batch berikutnya?</span>
          <button
            type="button" onClick={handleSplit}
            className="min-h-tap rounded-tile border border-warning px-2 text-[12px] font-semibold text-warning"
          >
            Bagi otomatis
          </button>
        </div>
      )}

      {expanded && (
        <div role="radiogroup" aria-label={`Pilih batch untuk ${line.nama}`} className="flex flex-col gap-1 rounded-tile border border-border-input p-2">
          {legacyAvailableRaw > 0 && (
            <label className="flex min-h-tap items-center gap-2 text-[13px] text-ink">
              <input
                type="radio" name={`batch-${line.itemId}-${line.batchId ?? 'legacy'}`} checked={line.batchId === undefined}
                onChange={() => { onChangeBatch(undefined, itemHargaEceran); setExpanded(false) }}
              />
              Stok lama · sisa {wholeOf(legacyAvailable)}
            </label>
          )}
          {batches.map(b => (
            <label key={b.batchId} className="flex min-h-tap items-center gap-2 text-[13px] text-ink">
              <input
                type="radio" name={`batch-${line.itemId}-${line.batchId ?? 'legacy'}`} checked={line.batchId === b.batchId}
                onChange={() => { onChangeBatch(b.batchId, b.hargaJual); setExpanded(false) }}
              />
              {formatTanggal(b.tanggalBeli)} · {supplierNama(b.supplierId)} · sisa {wholeOf(b.sisa)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function CartLineRow({
  line, allLines, itemHargaEceran, suppliers, onQtyChange, onHargaChange, onChangeBatch, onSplit, stockRows,
}: {
  line: CartLine
  allLines: CartLine[]
  itemHargaEceran: number
  suppliers: Supplier[] | undefined
  onQtyChange: (qtyWhole: number) => void
  onHargaChange: (value: number | null) => void
  onChangeBatch: (toBatchId: string | undefined, hargaNormal: number) => void
  onSplit: (splits: SplitLineInput[]) => void
  stockRows: { itemId: string; quantity: number }[] | undefined
}) {
  const warning = stockWarningFor(line, stockRows)
  const otherLines: CartLineLike[] = allLines
    .filter(l => l !== line)
    .map(l => ({ itemId: l.itemId, batchId: l.batchId, qty: l.qty }))

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-ink">{line.nama}</p>
          <PriceEdit line={line} onChange={onHargaChange} />
        </div>
        <p className="text-[15px] font-bold tabular-nums text-ink">
          {line.subtotal === null ? '—' : formatRupiah(rupiah(line.subtotal))}
        </p>
      </div>
      <BatchChip
        line={line} otherLines={otherLines} itemHargaEceran={itemHargaEceran} suppliers={suppliers}
        onChangeBatch={onChangeBatch} onSplit={onSplit}
      />
      <QtyStepper line={line} onChange={onQtyChange} />
      {warning && <p className="text-[13px] font-medium text-warning">{warning}</p>}
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
              checked ? 'border-transparent bg-mint-soft text-primary' : 'border-border-input bg-surface text-ink-disabled'
            } ${option.disabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <input type="radio" name="kasir-metode-bayar" value={option.value} checked={checked} disabled={option.disabled} onChange={() => {}} className="sr-only" />
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
              checked ? 'border-transparent bg-mint-soft text-primary' : 'border-border-input bg-surface text-ink-disabled'
            } ${option.disabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            <input type="radio" name="kasir-pengiriman" value={option.value} checked={checked} disabled={option.disabled} onChange={() => {}} className="sr-only" />
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

  const stockRows = useLiveQuery(() => db.stokProj.toArray(), [])
  const itemsProjRows = useLiveQuery(() => db.itemsProj.toArray(), [])
  const itemDefaults = new Map((itemsProjRows ?? []).map(i => [i.id, i.hargaEceran]))
  const suppliers = useSuppliers()

  useEffect(() => { if (saveError) errorRef.current?.focus() }, [saveError])
  useEffect(() => () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current) }, [])

  const diskon: Rupiah = rupiah(0)
  const total = subtract(rupiah(subtotal), diskon)

  const uangDiterimaTrimmed = uangDiterima.trim()
  const uangDiterimaValue =
    uangDiterimaTrimmed === '' || !Number.isInteger(Number(uangDiterimaTrimmed)) ? undefined : Number(uangDiterimaTrimmed)
  const kembalian = uangDiterimaValue === undefined ? undefined : subtract(rupiah(uangDiterimaValue), total)

  const unpricedNames = lines.filter(l => l.hargaSatuan === null).map(l => l.nama)

  const showToast = () => {
    setToastVisible(true)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToastVisible(false), TOAST_DURATION_MS)
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
          // Guarded by saveDisabled below: handleSave is unreachable while
          // any line's hargaSatuan/subtotal is still null.
          hargaSatuan: line.hargaSatuan as number,
          subtotal: line.subtotal as number,
          batchId: line.batchId,
          hargaNormal: line.hargaNormal,
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
      setSaveError('Transaksi gagal disimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled = lines.length === 0 || saving || unpricedNames.length > 0

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
        <div ref={errorRef} role="alert" tabIndex={-1} className="mx-4 mt-3 rounded-field border border-danger bg-danger-bg p-3 text-[13px] font-semibold text-danger focus-visible:outline-none">
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
            <CartLineRow
              key={`${line.itemId}:${line.batchId ?? 'legacy'}`}
              line={line}
              allLines={lines}
              itemHargaEceran={itemDefaults.get(line.itemId) ?? line.hargaNormal}
              suppliers={suppliers}
              onQtyChange={qtyWhole => cart.setQtyWhole(line.itemId, line.batchId, qtyWhole)}
              onHargaChange={value => cart.setHargaSatuan(line.itemId, line.batchId, value)}
              onChangeBatch={(toBatchId, hargaNormal) => cart.changeBatch(line.itemId, line.batchId, toBatchId, hargaNormal)}
              onSplit={splits => cart.applySplit(line.itemId, line.batchId, splits)}
              stockRows={stockRows}
            />
          ))
        )}
      </ul>

      {unpricedNames.length > 0 && (
        <p role="alert" className="mx-4 mt-2 text-[13px] font-medium text-danger">
          Isi harga untuk {unpricedNames.join(', ')}.
        </p>
      )}

      <div className="sticky bottom-0 z-sticky flex flex-col gap-3 rounded-b-card border-t border-border bg-surface-sunken p-4">
        <div className="flex items-center justify-between text-[14px] text-ink-muted">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatRupiah(rupiah(subtotal))}</span>
        </div>
        <div className="flex items-center justify-between text-[14px] text-danger">
          <span>Diskon</span>
          <span className="tabular-nums">{formatRupiah(diskon)}</span>
        </div>
        <div data-testid="kasir-total" aria-live="polite" role="status" className="flex items-center justify-between border-t border-dashed border-border-strong pt-3">
          <span className="text-[14px] font-semibold text-ink">Total</span>
          <span className="text-[26px] font-extrabold tabular-nums text-ink">{formatRupiah(total)}</span>
        </div>

        <PaymentMethodPills />

        <div className="flex flex-col gap-1">
          <label htmlFor="kasir-uang-diterima" className="text-[13px] font-medium text-ink">Uang diterima</label>
          <input
            id="kasir-uang-diterima" type="number" min={0} step={1} inputMode="numeric"
            value={uangDiterima} onChange={e => setUangDiterima(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          />
          {kembalian !== undefined && (
            <p className={`text-[13px] font-medium tabular-nums ${kembalian < 0 ? 'text-danger' : 'text-ink-muted'}`}>
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
            type="button" onClick={() => handleSave(true)} disabled={saveDisabled}
            className="min-h-tap flex-1 rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)] disabled:cursor-not-allowed disabled:text-ink-disabled"
          >
            Simpan &amp; buat baru
          </button>
          <button
            type="button" onClick={() => handleSave(false)} disabled={saveDisabled}
            className="min-h-tap flex-1 rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:cursor-not-allowed disabled:text-ink-disabled"
          >
            Simpan transaksi
          </button>
        </div>
      </div>
    </div>
  )
}
