import { useRef, type ChangeEvent, type KeyboardEvent } from 'react'

/**
 * MASTER.md section 8, verbatim:
 * "Wrapped in a real, visible <label> (never placeholder-as-label),
 * --field-bg, 1px --field-bd, radius --r-field, height --field-h, a leading
 * search icon marked aria-hidden="true", and a placeholder in
 * --field-placeholder. An adjacent 'Scan' secondary button for barcode
 * input. The field keeps focus after a scan so the next scan lands in the
 * right place."
 *
 * Architecture doc section 10, verbatim (the scan-detection mechanism):
 * "USB scanners present as HID keyboards. Detection is by inter-key
 * interval (machine-fast) terminated by Enter, distinguishing a scan from
 * human typing. No dependency."
 *
 * A controlled, dumb component with NO catalog-matching logic: it reports
 * "the user typed X" (onChange) and "the user scanned Y" (onScan) and has
 * no opinion on what either means. Deciding what to do when a scanned or
 * typed value matches no known item is the parent screen's job (Task 6b),
 * because this component has no catalog data.
 */

/**
 * A scan is machine-fast: a USB HID barcode scanner emits keystrokes far
 * faster than any human can type. 30ms is comfortably below realistic human
 * typing speed (even a fast burst runs 60-80ms/keystroke) while comfortably
 * above scanner-to-scanner variance, so it separates the two cases without
 * false positives in either direction. This codebase has no prior scan
 * threshold to match; this value is this task's judgment call, documented
 * per the brief's request.
 */
const SCAN_MAX_INTERVAL_MS = 30

/**
 * A single fast keystroke followed by Enter (for example a stray Enter
 * press) is not a scan: real barcodes are always several characters long.
 * Three keystrokes (two intervals) is the minimum needed to even measure
 * "fast", so it doubles as the floor below which timing is not evaluated
 * at all.
 */
const SCAN_MIN_LENGTH = 3

type Props = {
  value: string
  onChange: (value: string) => void
  onScan: (value: string) => void
  autoFocus?: boolean
}

export function SearchScanField({ value, onChange, onScan, autoFocus }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const keyTimestampsRef = useRef<number[]>([])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const timestamps = keyTimestampsRef.current
      const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i])
      const isScan =
        timestamps.length >= SCAN_MIN_LENGTH &&
        intervals.every(interval => interval <= SCAN_MAX_INTERVAL_MS)

      keyTimestampsRef.current = []

      if (isScan) {
        e.preventDefault()
        // Read the live DOM value rather than the value prop: this keeps
        // detection correct regardless of whether the parent's re-render
        // from the last keystroke's onChange has landed yet.
        const scanned = inputRef.current?.value ?? value
        onScan(scanned)
        // Cleared so the next scan starts from an empty field, and refocused
        // so consecutive scans land correctly (MASTER.md / architecture doc
        // section 10). Clearing on scan is this task's judgment call: the
        // brief does not spell it out, but leaving a stale barcode sitting
        // in the field would contradict "scan, scan, scan, save".
        onChange('')
        inputRef.current?.focus()
      }
      return
    }

    // Only printable single-character keys count toward the scan-timing
    // sequence. Modifier and navigation keys (Shift, Tab, arrows, and so
    // on) neither type a character nor indicate scan speed, and must not
    // reset or pollute the measured sequence.
    if (e.key.length !== 1) return
    keyTimestampsRef.current.push(Date.now())
  }

  const handleScanButtonClick = () => {
    // No hardware barcode-scanner integration exposes a manual trigger
    // anywhere in this codebase (the plan and specs name no such target).
    // Per the brief, this button stays visually present for spec
    // compliance without a fabricated scanning simulation; its only real
    // behavior is returning focus to the field, ready for the next
    // HID-keystroke scan. Judgment call, noted in the report.
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="kasir-search" className="text-[14px] font-medium text-ink">
        Cari barang
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            id="kasir-search"
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocus}
            placeholder="Cari nama barang atau scan barcode"
            className="h-[var(--field-h)] w-full rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] pl-9 pr-3 text-[14px] text-ink placeholder:text-[var(--field-placeholder)]"
          />
        </div>
        <button
          type="button"
          onClick={handleScanButtonClick}
          className="min-h-tap min-w-tap rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)]"
        >
          Scan
        </button>
      </div>
    </div>
  )
}
