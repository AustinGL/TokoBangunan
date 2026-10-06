import { useState, type FormEvent } from 'react'
import { OPSI_BIAYA } from './labelBiaya'
import { catatBiaya, ubahBiaya } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { localDayKey } from '../../domain/dashboard'
import type { KategoriBiaya } from '../../domain/events'
import type { Expense } from '../../domain/projections/expenses'
import { todayIsoDate } from '../../domain/tanggal'
import { Button } from '../../ui/Button'
import { DatePicker } from '../../ui/DatePicker'
import { RupiahInput } from '../../ui/RupiahInput'
import { Select } from '../../ui/Select'
import { Sheet } from '../../ui/Sheet'
import { SheetFooter } from '../../ui/SheetFooter'

type Props = {
  open: boolean
  onClose: () => void
  /** Given: the sheet corrects this expense (the old one is cancelled, a new one recorded) instead of adding one. */
  awal?: Expense
}

/** Records an operating expense. Dated today unless another day, never a future one, is picked. */
export function BiayaSheet({ open, onClose, awal }: Props) {
  const hariIni = todayIsoDate(systemClock)
  const [jumlah, setJumlah] = useState<number | null>(awal?.jumlah ?? null)
  const [kategori, setKategori] = useState<KategoriBiaya | null>(awal?.kategori ?? null)
  const [tanggal, setTanggal] = useState(awal ? localDayKey(new Date(awal.occurredAt)) : hariIni)
  const [catatan, setCatatan] = useState(awal?.catatan ?? '')
  const [jumlahError, setJumlahError] = useState<string | null>(null)
  const [kategoriError, setKategoriError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const jumlahSalah = jumlah === null || jumlah <= 0
    setJumlahError(jumlahSalah ? 'Jumlah wajib diisi dan lebih dari 0.' : null)
    setKategoriError(kategori === null ? 'Pilih kategori biaya.' : null)
    if (jumlahSalah || kategori === null || jumlah === null) return

    setSubmitError(null)
    setSubmitting(true)
    try {
      const ctx = { clock: systemClock, deviceId: getDeviceId() }
      if (awal) await ubahBiaya(awal.id, { jumlah, kategori, tanggal, catatan }, ctx)
      else await catatBiaya({ jumlah, kategori, tanggal, catatan }, ctx)
      onClose()
    } catch {
      setSubmitError('Biaya gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={awal ? 'Ubah biaya' : 'Biaya baru'}>
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger">
            {submitError}
          </p>
        )}
        <RupiahInput id="biaya-jumlah" label="Jumlah" required value={jumlah} onChange={setJumlah} error={jumlahError ?? undefined} />
        <Select
          id="biaya-kategori" label="Kategori" required options={OPSI_BIAYA}
          value={kategori} onChange={v => { setKategori(v as KategoriBiaya); setKategoriError(null) }}
          placeholder="Pilih kategori" error={kategoriError ?? undefined}
        />
        <DatePicker id="biaya-tanggal" label="Tanggal biaya" required value={tanggal} onChange={setTanggal} max={hariIni} />
        <div className="flex flex-col gap-1">
          <label htmlFor="biaya-catatan" className="text-sm font-medium text-ink">Catatan</label>
          <input
            id="biaya-catatan" value={catatan} onChange={e => setCatatan(e.target.value)}
            className="h-control rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-base text-ink md:text-sm"
          />
        </div>
        <SheetFooter>
          <Button type="submit" variant="primary" fullWidth loading={submitting} loadingLabel="Menyimpan...">
            Simpan biaya
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  )
}
