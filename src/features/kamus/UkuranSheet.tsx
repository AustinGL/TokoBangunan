import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'

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
}

export function UkuranSheet({ open, onClose, onSubmit, barangOptions, currentBarangId, initialValues }: Props) {
  const [ukuran, setUkuran] = useState(initialValues?.ukuran ?? '')
  const [hargaEceran, setHargaEceran] = useState(initialValues ? String(initialValues.hargaEceran) : '')
  const [stokMinimum, setStokMinimum] = useState(initialValues ? String(initialValues.stokMinimum) : '')
  const [barcode, setBarcode] = useState(initialValues?.barcode ?? '')
  const [barangId, setBarangId] = useState(currentBarangId)
  const [diarsipkan, setDiarsipkan] = useState(initialValues?.diarsipkan ?? false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (ukuran.trim() === '') {
      setError('Ukuran wajib diisi.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        ukuran: ukuran.trim(),
        hargaEceran: Number(hargaEceran) || 0,
        stokMinimum: Number(stokMinimum) || 0,
        barcode: barcode.trim() === '' ? null : barcode.trim(),
        barangId: barangId === currentBarangId ? undefined : barangId,
        diarsipkan,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={initialValues ? 'Ubah ukuran' : 'Ukuran baru'} variant="center">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="ukuran-text" className="text-[14px] font-medium text-ink">Ukuran</label>
          <input
            id="ukuran-text" value={ukuran} onChange={e => setUkuran(e.target.value)}
            placeholder="mis. 50 kg"
            aria-invalid={error ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ukuran-harga" className="text-[14px] font-medium text-ink">Harga eceran</label>
          <input
            id="ukuran-harga" type="number" inputMode="numeric" min={0} step={1}
            value={hargaEceran} onChange={e => setHargaEceran(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ukuran-min" className="text-[14px] font-medium text-ink">Stok minimum</label>
          <input
            id="ukuran-min" type="number" inputMode="numeric" min={0} step={1}
            value={stokMinimum} onChange={e => setStokMinimum(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ukuran-barcode" className="text-[14px] font-medium text-ink">Barcode</label>
          <input
            id="ukuran-barcode" value={barcode} onChange={e => setBarcode(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ukuran-barang" className="text-[14px] font-medium text-ink">Pindahkan ke barang lain</label>
          <select
            id="ukuran-barang" value={barangId} onChange={e => setBarangId(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          >
            {barangOptions.map(option => (
              <option key={option.barangId} value={option.barangId}>{option.nama}</option>
            ))}
          </select>
        </div>

        <label className="flex min-h-tap items-center gap-2 text-[14px] text-ink">
          <input type="checkbox" checked={diarsipkan} onChange={e => setDiarsipkan(e.target.checked)} className="h-5 w-5" />
          Arsipkan
        </label>

        <button
          type="submit" disabled={submitting}
          className="min-h-tap rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:text-ink-disabled"
        >
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>
    </Sheet>
  )
}
