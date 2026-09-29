import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { RupiahInput } from '../../ui/RupiahInput'
import { Select } from '../../ui/Select'

const isNonNegativeInteger = (value: string): boolean => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0
}

export type UkuranSheetValues = {
  ukuran: string
  hargaEceran: number
  stokMinimum: number
  barcode: string | null
  barangId?: string
  diarsipkan: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (values: UkuranSheetValues) => void | Promise<void>
  barangOptions: Array<{ barangId: string; nama: string }>
  currentBarangId: string
  /** Read-model shape (barcode: string | undefined), distinct from the onSubmit payload - see this file's own plan task. */
  initialValues?: { ukuran: string; hargaEceran: number; stokMinimum: number; barcode?: string; diarsipkan: boolean }
  /** Prefills barcode for a fresh create only (e.g. an unknown scan) - ignored once initialValues (an edit) is set. */
  initialBarcode?: string
}

export function UkuranSheet({ open, onClose, onSubmit, barangOptions, currentBarangId, initialValues, initialBarcode }: Props) {
  const [ukuran, setUkuran] = useState(initialValues?.ukuran ?? '')
  const [hargaEceran, setHargaEceran] = useState(initialValues ? String(initialValues.hargaEceran) : '')
  const [stokMinimum, setStokMinimum] = useState(initialValues ? String(initialValues.stokMinimum) : '')
  const [barcode, setBarcode] = useState(initialValues?.barcode ?? initialBarcode ?? '')
  const [barangId, setBarangId] = useState(currentBarangId)
  const [diarsipkan, setDiarsipkan] = useState(initialValues?.diarsipkan ?? false)
  const [error, setError] = useState<string | null>(null)
  const [hargaError, setHargaError] = useState<string | null>(null)
  const [stokError, setStokError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // A caller that opens this sheet from inside its own <form> (a picker's
    // "+" quick-add, nested at the DOM level even though that's invalid
    // HTML) would otherwise have this submit event bubble up and also
    // trigger the outer form's own onSubmit/validation while its own
    // fields are still empty.
    e.stopPropagation()

    const nextError = ukuran.trim() === '' ? 'Ukuran wajib diisi.' : null
    // An empty box must not become Rp 0: Number('') is 0, which would pass the
    // integer check below and quietly put the item on sale for free.
    const nextHargaError = hargaEceran.trim() === ''
      ? 'Harga eceran wajib diisi.'
      : isNonNegativeInteger(hargaEceran) ? null : 'Harga eceran harus bilangan bulat, minimal 0.'
    const nextStokError = stokMinimum.trim() === ''
      ? 'Stok minimum wajib diisi.'
      : isNonNegativeInteger(stokMinimum) ? null : 'Stok minimum harus bilangan bulat, minimal 0.'
    setError(nextError)
    setHargaError(nextHargaError)
    setStokError(nextStokError)
    if (nextError || nextHargaError || nextStokError) return

    setSubmitError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        ukuran: ukuran.trim(),
        hargaEceran: Number(hargaEceran),
        stokMinimum: Number(stokMinimum),
        barcode: barcode.trim() === '' ? null : barcode.trim(),
        barangId: barangId === currentBarangId ? undefined : barangId,
        diarsipkan,
      })
    } catch {
      // A rejected onSubmit (an IndexedDB write failure, a legacy virtual
      // barang, and so on) must surface, not vanish - see ItemForm.tsx's
      // own precedent for the same convention.
      setSubmitError('Ukuran gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={initialValues ? 'Ubah ukuran' : 'Ukuran baru'} variant="center">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-[14px] font-semibold text-danger">
            {submitError}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="ukuran-text" className="req text-[14px] font-medium text-ink">Ukuran</label>
          <input
            id="ukuran-text" value={ukuran} onChange={e => setUkuran(e.target.value)}
            placeholder="mis. 50 kg"
            aria-invalid={error ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <RupiahInput
          id="ukuran-harga" label="Harga eceran" required
          value={hargaEceran === '' ? null : Number(hargaEceran)}
          onChange={value => setHargaEceran(value === null ? '' : String(value))}
          error={hargaError ?? undefined}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="ukuran-min" className="req text-[14px] font-medium text-ink">Stok minimum</label>
          <input
            id="ukuran-min" type="number" inputMode="numeric" min={0} step={1}
            value={stokMinimum} onChange={e => setStokMinimum(e.target.value)}
            aria-invalid={stokError ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${stokError ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {stokError && <p className="text-[13px] text-danger">{stokError}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ukuran-barcode" className="text-[14px] font-medium text-ink">Barcode</label>
          <input
            id="ukuran-barcode" value={barcode} onChange={e => setBarcode(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          />
        </div>

        {/* Moving or archiving only means something for an ukuran that already exists. */}
        {initialValues && (
          <>
            <Select
              id="ukuran-barang" label="Pindahkan ke barang lain" value={barangId} onChange={setBarangId}
              options={barangOptions.map(option => ({ value: option.barangId, label: option.nama }))}
            />

            <label className="flex min-h-tap items-center gap-2 text-[14px] text-ink">
              <input type="checkbox" checked={diarsipkan} onChange={e => setDiarsipkan(e.target.checked)} className="h-5 w-5" />
              Arsipkan
            </label>

          </>
        )}

        <button
          type="submit" disabled={submitting}
          className="min-h-tap rounded-pill bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:text-ink-disabled"
        >
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>
    </Sheet>
  )
}
