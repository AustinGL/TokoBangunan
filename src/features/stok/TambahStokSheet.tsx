import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { RupiahInput } from '../../ui/RupiahInput'
import { BarangPicker } from '../shared/BarangPicker'
import { UkuranPicker } from '../shared/UkuranPicker'
import { SupplierPicker } from '../shared/SupplierPicker'
import { useKatalog } from '../shared/useKatalog'
import { useToast } from '../../ui/useToast'
import { recordStockPurchase } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { dateAtLocalNoon, todayIsoDate } from '../../domain/tanggal'
import { formatRupiah, rupiah } from '../../domain/money'

type Props = {
  open: boolean
  onClose: () => void
}

type FieldKey = 'barang' | 'ukuran' | 'jumlah' | 'hargaJual' | 'tanggal'
type FieldErrors = Partial<Record<FieldKey, string>>

const FIELD_LABELS: Record<FieldKey, string> = {
  barang: 'Nama barang',
  ukuran: 'Ukuran',
  jumlah: 'Jumlah',
  hargaJual: 'Harga jual',
  tanggal: 'Tanggal beli',
}

const isPositiveInteger = (value: string): boolean => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0
}

export function TambahStokSheet({ open, onClose }: Props) {
  const katalog = useKatalog()
  const { showToast } = useToast()

  const [barangId, setBarangId] = useState<string | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [tanggalBeli, setTanggalBeli] = useState(() => todayIsoDate(systemClock))
  const [jumlah, setJumlah] = useState('')
  const [hargaBeli, setHargaBeli] = useState<number | null>(null)
  const [hargaJual, setHargaJual] = useState<number | null>(null)

  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)

  const errorList = Object.entries(errors) as Array<[FieldKey, string]>
  const showSummary = errorList.length > 1 || submitError !== null

  useEffect(() => {
    // A failed submit with more than one validation error, or a failed
    // submit call itself, moves focus to the summary - matching ItemForm's
    // own established pattern (this plan's spec explicitly requires it:
    // "inline errors plus a focused summary"). Never on blur, only as a
    // direct result of the submit that produced it.
    if (showSummary) summaryRef.current?.focus()
  }, [showSummary])

  const handleBarangChange = (newBarangId: string) => {
    // Combobox.commit calls onChange even for an option that is already
    // selected (e.g. re-tapping the same barang) - without this guard that
    // would needlessly wipe the ukuran/harga jual the user already has.
    if (newBarangId === barangId) return
    setBarangId(newBarangId)
    // A previously chosen ukuran (and the harga jual it prefilled) belongs
    // to the OLD barang - carrying it forward would submit a stock purchase
    // against the wrong barang's ukuran (Review Focus item 1).
    setItemId(null)
    setHargaJual(null)
  }

  const handleUkuranChange = (newItemId: string, meta?: { hargaEceran: number }) => {
    // Same reason as handleBarangChange's own guard: Combobox.commit fires
    // onChange even when re-selecting the currently-selected option, which
    // must not re-trigger the prefill below and clobber a harga jual the
    // user has since typed (Review Focus item 5).
    if (newItemId === itemId) return
    setItemId(newItemId)
    // A one-time default applied at the moment of selection, not a value
    // that keeps overwriting what the user types afterward (Review Focus
    // item 5) - this handler only runs again on a fresh pick.
    if (meta) {
      // A just-created ukuran (UkuranPicker's own quick-add): its price
      // comes straight from the picker, which knows it immediately -
      // useKatalog's own live query has not necessarily re-fetched by the
      // time this fires, so looking the new id up in `katalog` here could
      // still find nothing and silently leave the previous ukuran's price
      // in place.
      setHargaJual(meta.hargaEceran)
    } else {
      const barang = katalog?.find(r => r.barangId === barangId)
      const ukuran = barang?.ukuran.find(u => u.id === newItemId)
      setHargaJual(ukuran?.hargaEceran ?? null)
    }
  }

  const totalPembelian = isPositiveInteger(jumlah) && hargaBeli !== null
    ? formatRupiah(rupiah(Number(jumlah) * hargaBeli))
    : null

  const resetForNextEntry = () => {
    setBarangId(null)
    setItemId(null)
    setJumlah('')
    setHargaBeli(null)
    setHargaJual(null)
    // supplierId and tanggalBeli deliberately survive - spec: "Simpan &
    // tambah lagi" keeps the supplier and tanggal for batch entry.
  }

  const submit = async (keepOpen: boolean) => {
    const nextErrors: FieldErrors = {}
    if (barangId === null) nextErrors.barang = 'Nama barang wajib diisi.'
    if (itemId === null) nextErrors.ukuran = 'Ukuran wajib diisi.'
    if (!isPositiveInteger(jumlah)) nextErrors.jumlah = 'Jumlah wajib diisi, bilangan bulat lebih dari 0.'
    if (hargaJual === null) nextErrors.hargaJual = 'Harga jual wajib diisi.'
    if (tanggalBeli.trim() === '') {
      nextErrors.tanggal = 'Tanggal beli wajib diisi.'
    } else if (tanggalBeli > todayIsoDate(systemClock)) {
      nextErrors.tanggal = 'Tanggal beli tidak boleh di masa depan.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitError(null)
    setSavedMessage(null)
    setSubmitting(true)
    try {
      const today = todayIsoDate(systemClock)
      await recordStockPurchase(
        {
          itemId: itemId!,
          qty: Number(jumlah),
          hargaJual: hargaJual!,
          hargaBeli: hargaBeli ?? undefined,
          supplierId: supplierId ?? undefined,
          // Only a genuinely PAST date gets forced to local noon (the
          // spec's own wording: "past dates stored at local noon"). Today
          // keeps createEvent's own default (the real current moment) -
          // forcing noon here would misrepresent a same-day purchase's
          // time, and would also tie every same-day batch to the exact
          // same tanggalBeli, breaking FIFO ordering among them
          // (batchPick's own comparator has no other tiebreaker).
          tanggalBeli: tanggalBeli === today ? undefined : dateAtLocalNoon(tanggalBeli),
        },
        { clock: systemClock, deviceId: getDeviceId() },
      )
      if (keepOpen) {
        resetForNextEntry()
        // showToast's own toast sits behind this Sheet's native <dialog>
        // top layer while the sheet is open, effectively invisible - a
        // known, real gap (see this task's own ledger). This inline
        // confirmation is what a user entering several batches in a row
        // actually sees; the toast call stays as a secondary channel for
        // any viewer where it does render.
        setSavedMessage('Stok ditambahkan.')
        showToast('Stok ditambahkan.')
      } else {
        onClose()
      }
    } catch {
      // A rejected recordStockPurchase (an IndexedDB write failure, quota
      // exceeded, an ukuran deleted mid-entry) must surface, not vanish -
      // see BarangSheet.tsx's own precedent for the same convention.
      setSubmitError('Stok gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void submit(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Tambah stok">
      <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
        {showSummary && (
          <div
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-field border border-danger bg-danger-bg p-4 text-[14px] text-danger focus-visible:outline-none"
          >
            {submitError ? (
              <p className="font-semibold">{submitError}</p>
            ) : (
              <>
                <p className="font-semibold">Periksa kembali isian berikut:</p>
                <ul className="mt-2 list-disc pl-5">
                  {errorList.map(([field, message]) => (
                    <li key={field}>{FIELD_LABELS[field]}: {message}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {savedMessage && (
          <p role="status" className="rounded-field border border-success bg-success-bg p-3 text-[14px] font-semibold text-success">
            {savedMessage}
          </p>
        )}

        <BarangPicker value={barangId} onChange={handleBarangChange} error={errors.barang} />
        <UkuranPicker barangId={barangId} value={itemId} onChange={handleUkuranChange} error={errors.ukuran} />
        <SupplierPicker value={supplierId} onChange={setSupplierId} />

        <div className="flex flex-col gap-1">
          <label htmlFor="tambah-stok-tanggal" className="text-[14px] font-medium text-ink">
            Tanggal beli<span aria-hidden="true"> *</span>
          </label>
          <input
            id="tambah-stok-tanggal" type="date" value={tanggalBeli} max={todayIsoDate(systemClock)}
            onChange={e => setTanggalBeli(e.target.value)}
            aria-invalid={errors.tanggal ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${errors.tanggal ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {errors.tanggal && <p className="text-[13px] text-danger">{errors.tanggal}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tambah-stok-jumlah" className="text-[14px] font-medium text-ink">
            Jumlah<span aria-hidden="true"> *</span>
          </label>
          <input
            id="tambah-stok-jumlah" type="number" inputMode="numeric" min={1} step={1}
            value={jumlah} onChange={e => setJumlah(e.target.value)}
            aria-invalid={errors.jumlah ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${errors.jumlah ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {errors.jumlah && <p className="text-[13px] text-danger">{errors.jumlah}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <RupiahInput id="tambah-stok-harga-beli" label="Harga beli" value={hargaBeli} onChange={setHargaBeli} />
          {totalPembelian && <p className="text-[13px] text-ink-muted">Total pembelian {totalPembelian}</p>}
        </div>

        <RupiahInput
          id="tambah-stok-harga-jual" label="Harga jual" required value={hargaJual} onChange={setHargaJual}
          error={errors.hargaJual}
        />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button" disabled={submitting} onClick={() => void submit(true)}
            className="min-h-tap rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)] disabled:opacity-50"
          >
            Simpan & tambah lagi
          </button>
          <button
            type="submit" disabled={submitting}
            className="min-h-tap rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:text-ink-disabled"
          >
            {submitting ? 'Menyimpan...' : 'Simpan stok'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
