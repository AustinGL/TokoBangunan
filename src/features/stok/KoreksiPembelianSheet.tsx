import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { RupiahInput } from '../../ui/RupiahInput'
import { correctBatch } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { dateAtLocalNoon, todayIsoDate } from '../../domain/tanggal'

/**
 * Structurally what riwayatStok.ts's own RiwayatBatchRow produces (plus,
 * harmlessly, its extra fields) - kept as this file's own type, not an
 * import, the same precedent commands.ts's own RecordSaleLine doc comment
 * establishes.
 */
type Props = {
  open: boolean
  onClose: () => void
  batch: {
    batchId: string
    supplierId?: string
    hargaBeli?: number
    hargaJual: number
    /** Full ISO datetime (batchesProj's own tanggalBeli, ultimately event.occurredAt). */
    tanggalBeli: string
    /** Whole units of the item's baseUnit - riwayatStok.ts's own already-converted value. */
    diterima: number
  }
  suppliers: Array<{ id: string; nama: string }>
}

const isNonNegativeInteger = (value: string): boolean => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0
}

/**
 * Single-purpose, single-caller sheet (a Riwayat stok row's own "⋯ Koreksi
 * pembelian" action) - same "owns its own command call" architecture as
 * TambahStokSheet/AturUkuranSheet. Fixes a mistyped purchase: supplier,
 * harga beli/jual, tanggal beli and jumlah, per spec default #5.
 */
export function KoreksiPembelianSheet({ open, onClose, batch, suppliers }: Props) {
  const [supplierId, setSupplierId] = useState(batch.supplierId ?? '')
  const [hargaBeli, setHargaBeli] = useState<number | null>(batch.hargaBeli ?? null)
  const [hargaJual, setHargaJual] = useState<number | null>(batch.hargaJual)
  // batch.tanggalBeli is a full ISO datetime; every purchase in this app is
  // recorded in an Indonesian timezone (UTC+7/8/9, always ahead of UTC), so
  // slicing its date part matches the calendar day the owner actually
  // picked - the mirror image of dateAtLocalNoon's own doc comment, which
  // makes the same assumption in the other direction.
  const [tanggalBeli, setTanggalBeli] = useState(batch.tanggalBeli.slice(0, 10))
  const [jumlah, setJumlah] = useState(String(batch.diterima))

  const [hargaJualError, setHargaJualError] = useState<string | null>(null)
  const [tanggalError, setTanggalError] = useState<string | null>(null)
  const [jumlahError, setJumlahError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const nextHargaJualError = hargaJual !== null && hargaJual >= 0 ? null : 'Harga jual wajib diisi, minimal 0.'
    let nextTanggalError: string | null = null
    if (tanggalBeli.trim() === '') {
      nextTanggalError = 'Tanggal beli wajib diisi.'
    } else if (tanggalBeli > todayIsoDate(systemClock)) {
      // A native date input's max is a soft UI hint a browser does not
      // strictly enforce on typed/pasted input - this independent check is
      // the real guard (same Review Focus item plan 08 already established
      // for TambahStokSheet's own tanggal beli field).
      nextTanggalError = 'Tanggal beli tidak boleh di masa depan.'
    }
    const nextJumlahError = isNonNegativeInteger(jumlah) ? null : 'Jumlah harus bilangan bulat, minimal 0.'

    setHargaJualError(nextHargaJualError)
    setTanggalError(nextTanggalError)
    setJumlahError(nextJumlahError)
    if (nextHargaJualError || nextTanggalError || nextJumlahError) return

    setSubmitError(null)
    setSubmitting(true)
    try {
      await correctBatch(
        {
          batchId: batch.batchId,
          supplierId: supplierId === '' ? undefined : supplierId,
          hargaBeli: hargaBeli ?? undefined,
          hargaJual: hargaJual!,
          tanggalBeli: dateAtLocalNoon(tanggalBeli).toISOString(),
          jumlah: Number(jumlah),
        },
        { clock: systemClock, deviceId: getDeviceId() },
      )
      onClose()
    } catch {
      setSubmitError('Koreksi gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Koreksi pembelian" variant="center">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-[14px] font-semibold text-danger">
            {submitError}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="koreksi-supplier" className="text-[14px] font-medium text-ink">Supplier</label>
          <select
            id="koreksi-supplier" value={supplierId} onChange={e => setSupplierId(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          >
            <option value="">Tidak ada</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="koreksi-tanggal" className="text-[14px] font-medium text-ink">
            Tanggal beli<span aria-hidden="true"> *</span>
          </label>
          <input
            id="koreksi-tanggal" type="date" value={tanggalBeli} max={todayIsoDate(systemClock)}
            onChange={e => setTanggalBeli(e.target.value)}
            aria-invalid={tanggalError ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${tanggalError ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {tanggalError && <p className="text-[13px] text-danger">{tanggalError}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="koreksi-jumlah" className="text-[14px] font-medium text-ink">Jumlah</label>
          <input
            id="koreksi-jumlah" type="number" inputMode="numeric" min={0} step={1}
            value={jumlah} onChange={e => setJumlah(e.target.value)}
            aria-invalid={jumlahError ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${jumlahError ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {jumlahError && <p className="text-[13px] text-danger">{jumlahError}</p>}
        </div>

        <RupiahInput id="koreksi-harga-beli" label="Harga beli" value={hargaBeli} onChange={setHargaBeli} />
        <RupiahInput
          id="koreksi-harga-jual" label="Harga jual" required value={hargaJual} onChange={setHargaJual}
          error={hargaJualError ?? undefined}
        />

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
