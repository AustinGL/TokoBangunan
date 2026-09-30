/**
 * Component breakdown table's exact row: "TanggalFilter.tsx | -- |
 * salesProj.where('occurredAt').between(...)". Scope item 6 covers only
 * this one filter this phase (metode bayar, perlu dikirim, ada piutang all
 * have nothing to filter yet, per the task brief).
 *
 * A single native input type=date, not a range: MASTER.md names no
 * dedicated date-picker component for this screen, and a single day
 * matches the "one nota, one day" mental model this design system's other
 * worked examples (Kasir's own daily flow) already lean on. Judgment call,
 * noted in the task report. null means "semua" (no filter, the default),
 * matching EMPTY_STOK_FILTERS's own null-means-unset convention in
 * useStokList.ts.
 */

import { systemClock } from '../../domain/clock'
import { isoDateDaysAgo } from '../../domain/tanggal'
import { Button } from '../../ui/Button'

type Props = {
  /** yyyy-mm-dd, or null for "semua" (no filter, the default). */
  value: string | null
  onChange: (value: string | null) => void
}

export function TanggalFilter({ value, onChange }: Props) {
  // The two days the owner asks about most, one tap each, before the date
  // picker (a bare dd/mm/yyyy box) is needed at all.
  const presets = [
    { label: 'Hari ini', date: isoDateDaysAgo(systemClock, 0) },
    { label: 'Kemarin', date: isoDateDaysAgo(systemClock, 1) },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <Button
          key={p.label}
          variant={value === p.date ? 'primary' : 'secondary'}
          aria-pressed={value === p.date}
          onClick={() => onChange(value === p.date ? null : p.date)}
        >
          {p.label}
        </Button>
      ))}
      <div className="flex items-center">
        <label htmlFor="transaksi-tanggal-filter" className="sr-only">
          Tanggal
        </label>
        <input
          id="transaksi-tanggal-filter"
          type="date"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
          className="h-control rounded-pill border border-[var(--field-bd)] bg-[var(--field-bg)] px-4 text-[14px] text-ink"
        />
      </div>
      {value !== null && (
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Tampilkan semua
        </Button>
      )}
    </div>
  )
}
