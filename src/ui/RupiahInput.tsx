import { useState } from 'react'

type Props = {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  required?: boolean
  error?: string
}

const formatter = new Intl.NumberFormat('id-ID')

const formatDisplay = (value: number | null): string => (value === null ? '' : formatter.format(value))

export function RupiahInput({ id, label, value, onChange, required, error }: Props) {
  // Displayed text is internal state, not derived straight from `value` on
  // every render (same pattern as Combobox's own text state): a caller
  // whose onChange doesn't feed a new `value` straight back on every
  // keystroke - a plain test double, or a form that only commits on submit -
  // would otherwise see the formatted display snap back to the old value
  // after every character typed, since the "." separators the previous
  // render's formatted text contributed are what let handleChange rebuild
  // the full digit string as the user types. `syncedValue` tracks the last
  // `value` we synced from, so an external change to `value` (including to
  // 0, which must display "0", not blank) is applied during render - React's
  // documented pattern for "adjusting state when a prop changes" - without
  // clobbering the user's own in-progress typing on every render.
  const [text, setText] = useState(() => formatDisplay(value))
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(formatDisplay(value))
  }

  const handleChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '')
    const next = digitsOnly === '' ? null : Number(digitsOnly)
    // Only `text` (this component's own display state) updates here -
    // `syncedValue` tracks the external `value` prop specifically, and must
    // stay untouched by a keystroke: a caller whose onChange doesn't feed a
    // new `value` straight back (this file's own tests; a form that only
    // commits on submit) still has an unchanged `value` prop next render, so
    // updating `syncedValue` here would make that unchanged prop look like a
    // fresh external change and wipe out what was just typed.
    setText(formatDisplay(next))
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[14px] font-medium text-ink">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={text}
        onChange={e => handleChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
      />
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}
