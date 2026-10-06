import { useState, type FormEvent } from 'react'
import { DatePicker } from '../../ui/DatePicker'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { SheetFooter } from '../../ui/SheetFooter'
import { RupiahInput } from '../../ui/RupiahInput'
import { Select } from '../../ui/Select'
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
  if (value.trim() === '') return false
  const n = Number(value)
  return Number.isInteger(n) && n >= 0
}

/**
 * Extracts a "yyyy-mm-dd" date input value from a full ISO datetime, using
 * this runtime's LOCAL calendar day - not a UTC slice, which can land on
 * the wrong day for a timestamp close to local midnight (e.g. a same-day
 * purchase recorded at 23:30 UTC is 06:30 the next day in WIB/UTC+7, so its
 * UTC slice would be the previous calendar day relative to the owner's local
 * view). Mirrors todayIsoDate's own local-Date-field approach in
 * domain/tanggal.ts, just reading an arbitrary Date instead of "now".
 */
function toIsoDate(isoDatetime: string): string {
  const d = new Date(isoDatetime)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  // Extract the local calendar day (not UTC slice, which can be wrong for
  // early-morning timestamps). See toIsoDate's doc comment for details.
  const [tanggalBeli, setTanggalBeli] = useState(toIsoDate(batch.tanggalBeli))
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
    const nextJumlahError = isNonNegativeInteger(jumlah) ? null : 'Jumlah wajib diisi, bilangan bulat minimal 0.'

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
          // Only forced to local-noon ISO when the picked date actually
          // differs from the batch's own current local calendar day - the
          // same "don't misrepresent an unchanged same-day timestamp"
          // reasoning TambahStokSheet.tsx's own tanggalBeli comment already
          // establishes. Leaving the date field untouched must preserve the
          // batch's real original timestamp exactly, not silently rewrite
          // it to noon on every correction (batchPick.ts sorts strictly by
          // tanggalBeli with no tiebreaker, so forcing noon on an unchanged
          // date would tie multiple same-day batches to one identical
          // timestamp and break FIFO ordering).
          tanggalBeli: tanggalBeli === toIsoDate(batch.tanggalBeli) ? batch.tanggalBeli : dateAtLocalNoon(tanggalBeli).toISOString(),
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
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger">
            {submitError}
          </p>
        )}

        <Select
          id="koreksi-supplier" label="Supplier" value={supplierId} onChange={setSupplierId}
          options={[{ value: '', label: 'Tidak ada' }, ...suppliers.map(s => ({ value: s.id, label: s.nama }))]}
        />

        <DatePicker
          id="koreksi-tanggal" label="Tanggal beli" required
          value={tanggalBeli} onChange={setTanggalBeli} max={todayIsoDate(systemClock)}
          error={tanggalError ?? undefined}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="koreksi-jumlah" className="text-sm font-medium text-ink">Jumlah</label>
          <input
            id="koreksi-jumlah" type="number" inputMode="numeric" min={0} step={1}
            value={jumlah} onChange={e => setJumlah(e.target.value)}
            aria-invalid={jumlahError ? true : undefined}
            aria-describedby={jumlahError ? 'koreksi-jumlah-error' : undefined}
            className={`h-control rounded-field border bg-[var(--field-bg)] px-3 text-base text-ink md:text-sm ${jumlahError ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {jumlahError && <p id="koreksi-jumlah-error" className="text-sm text-danger">{jumlahError}</p>}
        </div>

        <RupiahInput id="koreksi-harga-beli" label="Harga beli" value={hargaBeli} onChange={setHargaBeli} />
        <RupiahInput
          id="koreksi-harga-jual" label="Harga jual" required value={hargaJual} onChange={setHargaJual}
          error={hargaJualError ?? undefined}
        />

        <SheetFooter>
          <Button type="submit" variant="primary" fullWidth loading={submitting} loadingLabel="Menyimpan...">
            Simpan
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  )
}
