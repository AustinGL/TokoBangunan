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

type Props = {
  /** yyyy-mm-dd, or null for "semua" (no filter, the default). */
  value: string | null
  onChange: (value: string | null) => void
}

export function TanggalFilter({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="transaksi-tanggal-filter" className="text-[13px] font-medium text-ink">
          Tanggal
        </label>
        <input
          id="transaksi-tanggal-filter"
          type="date"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
          className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
        />
      </div>
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="min-h-tap rounded-tile px-3 text-[13px] font-medium text-ink-muted"
        >
          Tampilkan semua
        </button>
      )}
    </div>
  )
}
