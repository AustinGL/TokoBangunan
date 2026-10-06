/**
 * Component breakdown table's exact row: "TanggalFilter.tsx | -- |
 * salesProj.where('occurredAt').between(...)". Scope item 6 covers only
 * this one filter this phase (metode bayar, perlu dikirim, ada piutang all
 * have nothing to filter yet, per the task brief).
 *
 * A single DatePicker (one day), not a range: one day
 * matches the "one nota, one day" mental model this design system's other
 * worked examples (Kasir's own daily flow) already lean on. Judgment call,
 * noted in the task report. null means "semua" (no filter, the default),
 * matching EMPTY_STOK_FILTERS's own null-means-unset convention in
 * useStokList.ts.
 */

import { systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'
import { DatePicker } from '../../ui/DatePicker'
import { SegmentedControl } from '../../ui/SegmentedControl'

type Props = {
  /** yyyy-mm-dd, or null for "semua" (no filter, the default). */
  value: string | null
  onChange: (value: string | null) => void
}

const SEMUA = 'semua'

export function TanggalFilter({ value, onChange }: Props) {
  // The two days the owner asks about most, one tap each, before the date
  // picker (a bare dd/mm/yyyy box) is needed at all. They sit in a segmented
  // control with "Semua": the thumb slides to the chosen day, and choosing the
  // day that is already chosen clears it again.
  const hariIni = isoDateDaysAgo(systemClock, 0)
  const kemarin = isoDateDaysAgo(systemClock, 1)
  const options = [
    { value: SEMUA, label: 'Semua' },
    { value: hariIni, label: 'Hari ini' },
    { value: kemarin, label: 'Kemarin' },
  ]
  // A date picked by hand matches no segment, so the thumb simply hides.
  const selected = value === null ? SEMUA : value === hariIni || value === kemarin ? value : null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl
        aria-label="Pilih hari"
        options={options}
        value={selected}
        onChange={next => onChange(next === SEMUA || next === value ? null : next)}
      />
      <DatePicker
        id="transaksi-tanggal-filter" label="Tanggal" hideLabel variant="pill"
        value={value} onChange={onChange}
      />
    </div>
  )
}
