import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { RupiahInput } from '../../ui/RupiahInput'
import { updateUkuran } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'

type Props = {
  open: boolean
  onClose: () => void
  item: { id: string; ukuran: string; hargaEceran: number; stokMinimum: number }
}

const isNonNegativeInteger = (value: string): boolean => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0
}

/**
 * Single-purpose, single-caller sheet (Barang detail's own ukuran cards) -
 * owns its own updateUkuran call directly, the same architecture
 * TambahStokSheet already established, rather than the reusable
 * onSubmit-prop pattern BarangSheet/UkuranSheet use for their several
 * callers. Edits only harga jual (hargaEceran) and stok minimum - nama,
 * barcode and kategori stay Kamus's own job (spec default #4).
 */
export function AturUkuranSheet({ open, onClose, item }: Props) {
  const [hargaJual, setHargaJual] = useState<number | null>(item.hargaEceran)
  const [stokMinimum, setStokMinimum] = useState(String(item.stokMinimum))
  const [hargaError, setHargaError] = useState<string | null>(null)
  const [stokError, setStokError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const nextHargaError = hargaJual !== null && hargaJual >= 0 ? null : 'Harga jual wajib diisi, minimal 0.'
    const nextStokError = isNonNegativeInteger(stokMinimum) ? null : 'Stok minimum harus bilangan bulat, minimal 0.'
    setHargaError(nextHargaError)
    setStokError(nextStokError)
    if (nextHargaError || nextStokError) return

    setSubmitError(null)
    setSubmitting(true)
    try {
      await updateUkuran(
        { id: item.id, hargaEceran: hargaJual!, stokMinimum: Number(stokMinimum) },
        { clock: systemClock, deviceId: getDeviceId() },
      )
      onClose()
    } catch {
      // Matches BarangSheet/UkuranSheet/TambahStokSheet's own convention: a
      // rejected write must surface, not vanish.
      setSubmitError('Pengaturan ukuran gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Atur ${item.ukuran}`} variant="center">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-[14px] font-semibold text-danger">
            {submitError}
          </p>
        )}

        <RupiahInput
          id="atur-ukuran-harga" label="Harga jual" required value={hargaJual} onChange={setHargaJual}
          error={hargaError ?? undefined}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="atur-ukuran-min" className="text-[14px] font-medium text-ink">Stok minimum</label>
          <input
            id="atur-ukuran-min" type="number" inputMode="numeric" min={0} step={1}
            value={stokMinimum} onChange={e => setStokMinimum(e.target.value)}
            aria-invalid={stokError ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${stokError ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {stokError && <p className="text-[13px] text-danger">{stokError}</p>}
        </div>

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
