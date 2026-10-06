import { Calendar } from './Calendar'
import { PickerPopup } from './PickerPopup'
import { systemClock } from '../domain/clock'
import { adalahKey, ringkas } from '../domain/kalender'
import { todayIsoDate } from '../domain/tanggal'

type Props = {
  id: string
  label: string
  /** A yyyy-mm-dd day key, or null/'' for nothing chosen yet. */
  value: string | null
  onChange: (key: string) => void
  min?: string
  max?: string
  placeholder?: string
  error?: string
  hideLabel?: boolean
  required?: boolean
  disabled?: boolean
  variant?: 'field' | 'pill'
}

/** One day, picked from a calendar card. Choosing a day commits and closes. */
export function DatePicker({
  id, label, value, onChange, min, max, placeholder = 'Pilih tanggal', error, hideLabel, required, disabled, variant,
}: Props) {
  const hariIni = todayIsoDate(systemClock)
  // A value that is not a real day (a bad stored date) is shown as nothing chosen, never thrown on.
  const dipilih = adalahKey(value) ? value : null

  return (
    <PickerPopup
      id={id} label={label} hideLabel={hideLabel} required={required} error={error} disabled={disabled} variant={variant}
      teks={dipilih ? ringkas(dipilih) : placeholder} kosong={dipilih === null}
      tinggi={380} lebar={332}
    >
      {tutup => (
        <Calendar
          awal={dipilih ?? hariIni} jumlahBulan={1} hariIni={hariIni} min={min} max={max}
          pilihan={{ from: dipilih, to: dipilih }}
          onPilih={key => { onChange(key); tutup() }}
        />
      )}
    </PickerPopup>
  )
}
