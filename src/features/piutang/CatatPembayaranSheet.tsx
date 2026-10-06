import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { SheetFooter } from '../../ui/SheetFooter'
import { DatePicker } from '../../ui/DatePicker'
import { RupiahInput } from '../../ui/RupiahInput'
import { catatPembayaran, catatPembayaranTerlama } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { formatRupiah, rupiah } from '../../domain/money'
import { shortNota } from '../../domain/nota'
import { alokasiTerlama, tanggalBayarTerendah, type NotaBelumLunas } from '../../domain/piutang'
import { todayIsoDate } from '../../domain/tanggal'

export type PembayaranMode =
  /** occurredAt: when the nota was made; a payment cannot be dated before it. */
  | { kind: 'nota'; saleId: string; nomor: string; sisa: number; occurredAt: string }
  | { kind: 'terlama'; customerId: string; nota: NotaBelumLunas[]; totalSisa: number }

type Props = { open: boolean; onClose: () => void; mode: PembayaranMode }

/**
 * Records a payment: against one nota (starts at its sisa) or, from the
 * customer's page, against all their notas oldest-due-first with a live
 * preview of how the amount is split. The payment is dated today unless a
 * different day is chosen: never in the future, and never before the latest
 * nota it pays (for oldest-first, the notas the amount actually reaches).
 */
export function CatatPembayaranSheet({ open, onClose, mode }: Props) {
  const maks = mode.kind === 'nota' ? mode.sisa : mode.totalSisa
  const [jumlah, setJumlah] = useState<number | null>(mode.kind === 'nota' ? mode.sisa : null)
  const [catatan, setCatatan] = useState('')
  const hariIni = todayIsoDate(systemClock)
  const [tanggal, setTanggal] = useState(hariIni)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const valid = jumlah !== null && jumlah > 0 && jumlah <= maks
  const pembagian = mode.kind === 'terlama' && valid ? alokasiTerlama(mode.nota, jumlah) : []

  // With no amount typed yet, the oldest nota is the one a payment would reach first.
  const disentuh = mode.kind === 'nota'
    ? [{ occurredAt: mode.occurredAt }]
    : mode.nota.filter(n => (valid ? pembagian : mode.nota.length > 0 && maks > 0 ? alokasiTerlama(mode.nota, 1) : []).some(a => a.saleId === n.saleId))
  const minTanggal = tanggalBayarTerendah(disentuh)
  const tanggalError = minTanggal !== undefined && tanggal < minTanggal ? 'Tanggal bayar tidak boleh sebelum tanggal nota.' : undefined

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (jumlah === null || jumlah <= 0) {
      setError('Jumlah wajib diisi dan lebih dari 0.')
      return
    }
    if (jumlah > maks) {
      setError(`Jumlah melebihi sisa ${formatRupiah(rupiah(maks))}.`)
      return
    }
    if (tanggalError) return
    setError(null)
    setSubmitError(null)
    setSubmitting(true)
    try {
      const ctx = { clock: systemClock, deviceId: getDeviceId() }
      if (mode.kind === 'nota') await catatPembayaran({ saleId: mode.saleId, jumlah, catatan, tanggal }, ctx)
      else await catatPembayaranTerlama({ customerId: mode.customerId, jumlah, catatan, tanggal }, ctx)
      onClose()
    } catch {
      setSubmitError('Pembayaran gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={mode.kind === 'nota' ? `Catat pembayaran ${mode.nomor}` : 'Lunasi dari yang terlama'}>
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger">
            {submitError}
          </p>
        )}
        <p className="text-sm text-ink-muted">Sisa piutang: <span className="font-semibold tabular-nums text-ink">{formatRupiah(rupiah(maks))}</span></p>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <RupiahInput id="bayar-jumlah" label="Jumlah dibayar" value={jumlah} onChange={setJumlah} error={error ?? undefined} />
          </div>
          <Button type="button" variant="secondary" onClick={() => setJumlah(maks)}>Lunas</Button>
        </div>

        {pembagian.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-ink">Pembagian</h3>
            <ul aria-label="Pembagian pembayaran" className="flex flex-col gap-1 text-sm text-ink-muted">
              {pembagian.map(p => (
                <li key={p.saleId} className="flex items-center justify-between">
                  <span className="tabular-nums">{shortNota(p.saleId)}</span>
                  <span className="tabular-nums text-ink">{formatRupiah(rupiah(p.jumlah))}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DatePicker
          id="bayar-tanggal" label="Tanggal bayar" required
          value={tanggal} onChange={setTanggal} min={minTanggal} max={hariIni}
          error={tanggalError}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="bayar-catatan" className="text-sm font-medium text-ink">Catatan</label>
          <input id="bayar-catatan" value={catatan} onChange={e => setCatatan(e.target.value)}
            className="h-control rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-base text-ink md:text-sm" />
        </div>

        <SheetFooter>
          <Button type="submit" variant="primary" fullWidth loading={submitting} loadingLabel="Menyimpan...">
            Simpan pembayaran
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  )
}
