import { useState } from 'react'
import { Calendar } from './Calendar'
import { PickerPopup } from './PickerPopup'
import { useMediaQuery } from './useMediaQuery'
import { systemClock } from '../domain/clock'
import { adalahKey, ringkas } from '../domain/kalender'
import type { Rentang } from '../domain/laporan'
import { todayIsoDate } from '../domain/tanggal'

type Props = {
  id: string
  label: string
  value: Rentang | null
  onChange: (rentang: Rentang) => void
  min?: string
  max?: string
  placeholder?: string
  hideLabel?: boolean
  disabled?: boolean
}

/**
 * A range from one calendar card: the first click sets the start, the second
 * the end (an earlier end swaps them) and closes. Two months side by side from
 * 768px, one below. A start without its end is dropped when the card closes.
 */
export function DateRangePicker({
  id, label, value: nilaiMentah, onChange, min, max, placeholder = 'Tanggal mulai → Tanggal akhir', hideLabel, disabled,
}: Props) {
  // A range with an end that is not a real day is shown as nothing chosen, never thrown on.
  const value = nilaiMentah && adalahKey(nilaiMentah.from) && adalahKey(nilaiMentah.to) ? nilaiMentah : null
  const hariIni = todayIsoDate(systemClock)
  const duaBulan = useMediaQuery('(min-width: 768px)', true)
  const [awal, setAwal] = useState<string | null>(null)
  const [pratinjau, setPratinjau] = useState<string | null>(null)

  const reset = () => { setAwal(null); setPratinjau(null) }

  return (
    <PickerPopup
      id={id} label={label} hideLabel={hideLabel} disabled={disabled}
      teks={value ? `${ringkas(value.from)} → ${ringkas(value.to)}` : placeholder} kosong={value === null}
      tinggi={430} lebar={duaBulan ? 664 : 332}
      onBuka={reset} onTutup={reset}
    >
      {tutup => (
        <>
          <Calendar
            awal={value?.from ?? hariIni} jumlahBulan={duaBulan ? 2 : 1} hariIni={hariIni} min={min} max={max}
            pilihan={awal ? { from: awal, to: null } : value ? { from: value.from, to: value.to } : { from: null, to: null }}
            pratinjau={awal ? pratinjau : null}
            onFokusHari={setPratinjau}
            onPilih={key => {
              if (awal === null) { setAwal(key); return }
              onChange(key < awal ? { from: key, to: awal } : { from: awal, to: key })
              tutup()
            }}
          />
          {/* Always mounted, so a screen reader announces the text when it appears; out of the layout while empty. */}
          <p data-testid="petunjuk-akhir" role="status" className={awal ? 'mt-2 text-center text-xs text-ink-muted' : 'sr-only'}>
            {awal ? 'Pilih tanggal akhir.' : ''}
          </p>
        </>
      )}
    </PickerPopup>
  )
}
