// src/features/kasir/CartPanel.tsx
import { useEffect, useRef, useState } from 'react'
import { Pencil, ChevronDown, Minus, Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { fromBase, qty } from '../../domain/quantity'
import { formatRupiah, rupiah, subtract, type Rupiah } from '../../domain/money'
import { shortNota } from '../../domain/nota'
import { recordSale, type RecordSaleInput } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { useBatches } from '../shared/useBatches'
import { useSuppliers } from '../shared/useSuppliers'
import { formatTanggal } from '../shared/formatTanggal'
import { RupiahInput } from '../../ui/RupiahInput'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { Icon } from '../../ui/Icon'
import { legacyRemainder, availableForLine, planSplit } from '../../domain/batchPick'
import type { Supplier } from '../../domain/projections/suppliers'
import type { Batch } from '../../domain/projections/batches'
import { movedHargaSatuan, type CartLine, type UseCartResult, type SplitLineInput } from './useCart'

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
  /**
   * True when the panel is rendered inside the phone cart sheet: the sheet
   * supplies the title, the panel drops its own card chrome and height cap,
   * and its action buttons stick to the bottom of the sheet's scroller.
   */
  embedded?: boolean
  /** Called when the owner dismisses the receipt ("Transaksi baru"). The phone sheet uses it to close itself. */
  onDone?: () => void
}

type Receipt = { saleId: string; total: number; uangDiterima?: number; kembalian?: number }

/**
 * A human name for where a cart line's stock comes from, used in accessible
 * names only: "Stok lama", or "batch 2, 29 Sep 2026" (the batch's position in
 * that item's oldest-first order plus its purchase date). Never the raw batch
 * id, which is a 36-character UUID a screen reader would read out.
 */
function useSourceLabel(line: CartLine): string {
  const batches = useBatches(line.itemId)
  if (line.batchId === undefined) return 'Stok lama'
  const index = batches?.findIndex(b => b.batchId === line.batchId) ?? -1
  // A batch this device has not folded yet: fall back to the id's last four characters, only so two such lines still get distinct names.
  if (batches === undefined || index < 0) return `batch ${line.batchId.slice(-4)}`
  return `batch ${index + 1}, ${formatTanggal(batches[index].tanggalBeli)}`
}

/** Cash a customer is likely to hand over, for the quick-amount buttons: the exact total, then the next two common notes above it. */
const NOTES = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000]
function quickAmounts(total: number): number[] {
  if (total <= 0) return []
  const above = NOTES.filter(n => n > total).slice(0, 2)
  return [total, ...above]
}

function stockWarningFor(line: CartLine, stockRows: { itemId: string; quantity: number }[] | undefined): string | undefined {
  if (stockRows === undefined) return undefined
  const row = stockRows.find(r => r.itemId === line.itemId)
  const milliQty = row?.quantity ?? 0
  const stockWhole = fromBase(qty(milliQty), { unit: line.unit, factor: 1 })
  if (line.qtyWhole <= stockWhole) return undefined
  return `Stok ${line.nama} tinggal ${stockWhole} ${line.unit}. Lanjutkan?`
}

function QtyStepper({ line, sourceLabel, onChange }: { line: CartLine; sourceLabel: string; onChange: (qtyWhole: number) => void }) {
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
      <IconButton icon={Minus} label="Kurangi jumlah" shape="field" onClick={() => onChange(line.qtyWhole - 1)} />
      <div className="flex flex-col items-center">
        {/* The - and + buttons already say what this is for; a visible "Jumlah" above the box only cost a row of height. */}
        <label htmlFor={inputId} className="sr-only">
          Jumlah {line.nama} ({sourceLabel})
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
          className="h-control w-16 rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-2 text-center text-[14px] text-ink"
        />
      </div>
      <IconButton icon={Plus} label="Tambah jumlah" shape="field" onClick={() => onChange(line.qtyWhole + 1)} />
    </div>
  )
}

function PriceEdit({ line, sourceLabel, onChange }: { line: CartLine; sourceLabel: string; onChange: (value: number | null) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(line.hargaSatuan === null ? '' : String(line.hargaSatuan))
  const inputId = `kasir-harga-${line.itemId}-${line.batchId ?? 'legacy'}`
  const diubah = line.hargaSatuan !== null && line.hargaSatuan !== line.hargaNormal

  if (!editing) {
    // No aria-label: it would replace the visible price / "Isi harga" /
    // "(diubah, ...)" text in the accessible name entirely (WCAG 2.5.3,
    // label in name). A visually-hidden prefix instead adds the line's
    // context - unique per (item, batch) line, the same source label QtyStepper own label uses
    // QtyStepper's own label uses - ahead of the visible content, so
    // assistive tech hears both.
    return (
      <button
        type="button"
        onClick={() => { setDraft(line.hargaSatuan === null ? '' : String(line.hargaSatuan)); setEditing(true) }}
        className="flex min-h-control min-w-control items-center gap-1 text-[12px] tabular-nums text-ink-faint"
      >
        {/* The separating spaces sit OUTSIDE the spans on purpose: accessible-name computation trims each element's own text, and a whitespace-only text node renders nothing inside this flex button. */}
        <span className="sr-only">Ubah harga {line.nama} ({sourceLabel}):</span>{' '}
        {line.hargaSatuan === null ? 'Isi harga' : `${formatRupiah(rupiah(line.hargaSatuan))} / ${line.unit}`}
        <Icon icon={Pencil} size="micro" />
        {diubah && (
          <>{' '}<span className="text-warning">(diubah, normal {formatRupiah(rupiah(line.hargaNormal))})</span></>
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
      <label htmlFor={inputId} className="sr-only">Harga {line.nama} ({sourceLabel})</label>
      <input
        id={inputId}
        inputMode="numeric"
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        className="h-control w-28 rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-2 text-[13px] text-ink"
      />
    </div>
  )
}

function BatchChip({
  line, otherLines, itemHargaEceran, suppliers, onChangeBatch, onSplit,
}: {
  line: CartLine
  /** Every other line in the cart (full CartLines, not just CartLineLike: the split offer needs their prices too). */
  otherLines: CartLine[]
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
  const overSisa = line.qty > available

  // The split keeps on the line's current source (its batch, or the legacy
  // pool) whatever that source can still cover, and plans only the rest
  // across the OTHER batches, oldest first - exactly what the "Ambil N ...
  // dari batch berikutnya?" copy promises, and never overriding a batch the
  // owner deliberately switched to. Anything even the other batches cannot
  // cover stays on the current source as a warned over-sell (applySplit
  // keeps every unmoved unit there), so the split never loses quantity.
  //
  // A batch that already has its own separate line for this item is only a
  // split target when merging into it keeps the moved units' price (the
  // manual price carried over, or that batch's own default) - applySplit
  // refuses any merge that would silently re-price them, so offering one
  // would be a button that does nothing.
  const priceSafeTarget = (b: Batch) => {
    const existing = otherLines.find(l => l.itemId === line.itemId && l.batchId === b.batchId)
    return existing === undefined || existing.hargaSatuan === movedHargaSatuan(line, b.hargaJual)
  }
  const splitPlan = overSisa
    ? planSplit(
        line.itemId,
        line.qty - Math.max(0, available),
        batches.filter(b => b.batchId !== line.batchId && priceSafeTarget(b)),
        otherLines,
      )
    : []
  const movableQty = splitPlan.reduce((sum, p) => sum + p.qty, 0)
  // Only offer a split that would actually move something: with no other
  // batch left to draw from (a legacy-only item sold past its legacy stock,
  // a never-purchased ukuran), the plain stock warning below is all there is.
  const canSplit = movableQty > 0

  const handleSplit = () => {
    if (!canSplit) return
    const splits: SplitLineInput[] = splitPlan.map(p => ({
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
        className="flex min-h-control items-center gap-1 text-[12px] text-ink-faint"
      >
        {label}
        <Icon icon={ChevronDown} size="inline" />
      </button>

      {canSplit && (
        // Plain, non-alert markup - same convention stockWarningFor's own
        // "quantity exceeds what's available" warning already uses just
        // below (a <p>, no role="alert"): this is a proactive nudge, not a
        // blocking error, and a role="alert" here would collide with (and
        // make ambiguous) CartPanel's own save-error alert whenever both are
        // visible at once.
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-warning">
          <span>Ambil {wholeOf(movableQty)} {line.unit} dari batch berikutnya?</span>
          <Button variant="secondary" size="sm" onClick={handleSplit}>
            Bagi otomatis
          </Button>
        </div>
      )}

      {expanded && (
        <div role="radiogroup" aria-label={`Pilih batch untuk ${line.nama}`} className="flex flex-col gap-1 rounded-tile border border-border-input p-2">
          {legacyAvailableRaw > 0 && (
            <label className="flex min-h-control items-center gap-2 text-[13px] text-ink">
              <input
                type="radio" name={`batch-${line.itemId}-${line.batchId ?? 'legacy'}`} checked={line.batchId === undefined}
                onChange={() => { onChangeBatch(undefined, itemHargaEceran); setExpanded(false) }}
              />
              Stok lama · sisa {wholeOf(legacyAvailable)}
            </label>
          )}
          {batches.map(b => (
            <label key={b.batchId} className="flex min-h-control items-center gap-2 text-[13px] text-ink">
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
  const otherLines = allLines.filter(l => l !== line)
  const sourceLabel = useSourceLabel(line)

  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-ink">{line.nama}</p>
          <PriceEdit line={line} sourceLabel={sourceLabel} onChange={onHargaChange} />
        </div>
        <p className="text-[15px] font-bold tabular-nums text-ink">
          {line.subtotal === null ? '—' : formatRupiah(rupiah(line.subtotal))}
        </p>
      </div>
      <BatchChip
        line={line} otherLines={otherLines} itemHargaEceran={itemHargaEceran} suppliers={suppliers}
        onChangeBatch={onChangeBatch} onSplit={onSplit}
      />
      <QtyStepper line={line} sourceLabel={sourceLabel} onChange={onQtyChange} />
      {warning && <p className="text-[13px] font-medium text-warning">{warning}</p>}
    </li>
  )
}

export function CartPanel({ cart, onSaveAndNew, embedded = false, onDone }: Props) {
  const { lines, subtotal } = cart
  const [uangDiterima, setUangDiterima] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  // The receipt stays until the owner dismisses it or starts the next sale:
  // the cashier still has to tell the customer their change AFTER saving, so
  // it must not time out the way a toast would. Adding a line ends it.
  if (receipt && lines.length > 0) setReceipt(null)

  const stockRows = useLiveQuery(() => db.stokProj.toArray(), [])
  const itemsProjRows = useLiveQuery(() => db.itemsProj.toArray(), [])
  const itemDefaults = new Map((itemsProjRows ?? []).map(i => [i.id, i.hargaEceran]))
  const suppliers = useSuppliers()

  useEffect(() => { if (saveError) errorRef.current?.focus() }, [saveError])

  // No discount feature exists yet, so the total is the subtotal. (A
  // permanent "Diskon Rp 0" row, in danger red, only spent height and
  // signalled a problem that was not there.)
  const diskon: Rupiah = rupiah(0)
  const total = subtract(rupiah(subtotal), diskon)

  const kembalian = uangDiterima === null ? undefined : subtract(rupiah(uangDiterima), total)

  const unpricedNames = lines.filter(l => l.hargaSatuan === null).map(l => l.nama)

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
        uangDiterima: uangDiterima ?? undefined,
        customerId: undefined,
      }
      const saleId = await recordSale(input, { clock: systemClock, deviceId: getDeviceId() })
      cart.clear()
      setReceipt({ saleId, total, uangDiterima: uangDiterima ?? undefined, kembalian })
      setUangDiterima(null)
      if (andNew) onSaveAndNew?.()
    } catch {
      setSaveError('Transaksi gagal disimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled = lines.length === 0 || saving || unpricedNames.length > 0

  const dismissReceipt = () => {
    setReceipt(null)
    onDone?.()
  }

  const amounts = quickAmounts(total)

  return (
    <div
      className={`flex flex-col bg-surface ${
        embedded ? '' : 'rounded-card border border-border shadow-card lg:max-h-[calc(100dvh-2rem)]'
      }`}
    >
      {!embedded && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="text-[15px] font-bold text-ink">Keranjang</h2>
          <span className="inline-flex min-h-[24px] items-center rounded-[var(--r-pill)] bg-accent-100 px-[10px] text-[12px] font-semibold text-primary">
            {lines.length}
          </span>
        </div>
      )}

      {receipt && (
        <div role="status" aria-live="polite" className="mx-4 mt-3 flex shrink-0 flex-col gap-2 rounded-inner bg-success-bg p-4">
          <p className="text-[13px] font-semibold text-success">
            <span>Transaksi tersimpan</span> <span className="tabular-nums">{shortNota(receipt.saleId)}</span>
          </p>
          <p className="flex items-baseline justify-between text-[14px] text-ink">
            <span>Total</span>
            <span className="font-semibold tabular-nums">{formatRupiah(rupiah(receipt.total))}</span>
          </p>
          {receipt.uangDiterima !== undefined && (
            <p className="flex items-baseline justify-between text-[14px] text-ink">
              <span>Uang diterima</span>
              <span className="tabular-nums">{formatRupiah(rupiah(receipt.uangDiterima))}</span>
            </p>
          )}
          {receipt.kembalian !== undefined && (
            <div className="flex flex-col rounded-tile bg-surface px-3 py-2">
              <span className="text-[12px] font-medium text-ink-muted">{receipt.kembalian < 0 ? 'Kurang' : 'Kembalian'}</span>
              <span className="text-[28px] font-extrabold leading-8 tabular-nums text-ink">
                {formatRupiah(rupiah(Math.abs(receipt.kembalian)))}
              </span>
            </div>
          )}
          <Button variant="primary" onClick={dismissReceipt}>
            Transaksi baru
          </Button>
        </div>
      )}

      {saveError && (
        <div ref={errorRef} role="alert" tabIndex={-1} className="mx-4 mt-3 shrink-0 rounded-field border border-danger bg-danger-bg p-3 text-[13px] font-semibold text-danger focus-visible:outline-none">
          {saveError}
        </div>
      )}

      {/* min-h-0 + overflow: this is the only part of the card that scrolls, so
          the payment block and the save button below it never leave the screen.
          Inside the phone sheet the sheet's own body scrolls instead. */}
      <ul className={`min-h-[96px] flex-1 px-4 ${embedded ? '' : 'overflow-y-auto'}`}>
        {lines.length === 0 ? (
          <li className="py-6 text-center text-[14px] text-ink-muted">
            {receipt ? 'Siap untuk transaksi berikutnya.' : 'Keranjang kosong. Tambahkan barang untuk mulai.'}
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
        <p role="alert" className="mx-4 mt-2 shrink-0 text-[13px] font-medium text-danger">
          Isi harga untuk {unpricedNames.join(', ')}.
        </p>
      )}

      {/* Right after a sale the receipt above is the whole story: an empty total and two disabled buttons would only push it up the screen. */}
      {!(receipt && lines.length === 0) && (
        <div className="flex shrink-0 flex-col gap-3 rounded-b-card border-t border-border bg-surface-sunken p-4">
          <div data-testid="kasir-total" aria-live="polite" role="status" className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-ink">Total</span>
            <span className="text-[26px] font-extrabold tabular-nums text-ink">{formatRupiah(total)}</span>
          </div>

          <div className="flex flex-col gap-2">
            <RupiahInput id="kasir-uang-diterima" label="Uang diterima" value={uangDiterima} onChange={setUangDiterima} />
            {amounts.length > 0 && (
              <div role="group" aria-label="Jumlah uang cepat" className="flex flex-wrap gap-2">
                {amounts.map((amount, i) => (
                  <Button
                    key={amount} variant="secondary" size="sm" onClick={() => setUangDiterima(amount)}
                    className="tabular-nums"
                  >
                    {i === 0 ? 'Uang pas' : formatRupiah(rupiah(amount))}
                  </Button>
                ))}
              </div>
            )}
            {kembalian !== undefined && (
              <p className={`text-[20px] font-bold tabular-nums ${kembalian < 0 ? 'text-danger' : 'text-ink'}`}>
                Kembalian: {formatRupiah(kembalian)}
              </p>
            )}
          </div>

          {/* Payment methods, delivery and customer are not built yet. They used
              to render as faint, permanently disabled options that looked
              tappable; one honest line takes less room and cannot be mistaken
              for a control. */}
          <div className="text-[13px] text-ink-muted">
            <p><span className="sr-only">Pembayaran: </span>Tunai · Dibawa sekarang · Tanpa pelanggan</p>
            <p>Transfer, QRIS, Bon, dan Kirim segera hadir.</p>
          </div>

          <div className={`flex flex-col gap-2 ${embedded ? 'sticky bottom-0 z-sticky -mx-4 -mb-4 border-t border-border bg-surface-sunken p-4' : ''}`}>
            <Button variant="primary" fullWidth onClick={() => handleSave(false)} disabled={saveDisabled}>
              Simpan transaksi
            </Button>
            <Button variant="secondary" fullWidth onClick={() => handleSave(true)} disabled={saveDisabled}>
              Simpan &amp; buat baru
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
