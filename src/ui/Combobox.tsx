import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'

export type ComboboxOption = { value: string; label: string }

type Props = {
  id: string
  label: string
  options: ComboboxOption[]
  value: string | null
  onChange: (value: string) => void
  /** Typed text matching no option's label exactly (case-insensitive) offers a "Tambah "<text>"" row; selecting it calls this instead of onChange. */
  onCreate?: (text: string) => void
  placeholder?: string
  error?: string
  disabled?: boolean
}

const CREATE_VALUE = '__create__'

export function Combobox({ id, label, options, value, onChange, onCreate, placeholder, error, disabled }: Props) {
  const listboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  // Tracks the blur-driven close/reset timeout below, so a refocus before
  // it fires can cancel it - otherwise it fires later regardless, clobbering
  // whatever the user has typed since refocusing (a stale timer from a
  // blur that already happened, not the current one).
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // `query` is null whenever the user isn't actively editing the field -
  // the displayed text is then derived fresh from `options`/`value` every
  // render, rather than cached from a `value`-only sync effect. That cache
  // was the bug: options (from useKatalog's useLiveQuery) can still be
  // `undefined`/`[]` on the render `value` first arrives, then populate on
  // a later render where `value` itself hasn't changed - a value-only sync
  // never re-ran, so the field stayed permanently blank despite holding a
  // real selection. Non-null `query` holds the user's in-progress typing,
  // independent of `value`, exactly as before.
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  // -1: nothing highlighted. Only typing or an arrow key moves this to 0+ -
  // focus alone must not, or a bare Enter right after tabbing in would
  // silently select the first option.
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''
  const text = query ?? selectedLabel

  const normalizedText = text.trim().toLowerCase()
  const filtered = useMemo(
    () => (normalizedText === '' ? options : options.filter(o => o.label.toLowerCase().includes(normalizedText))),
    [options, normalizedText],
  )
  const exactMatch = options.some(o => o.label.toLowerCase() === normalizedText)
  const showCreateRow = Boolean(onCreate) && text.trim() !== '' && !exactMatch
  const rows: Array<ComboboxOption | { value: typeof CREATE_VALUE; label: string }> = showCreateRow
    ? [...filtered, { value: CREATE_VALUE, label: `Tambah "${text.trim()}"` }]
    : filtered

  const commit = (row: (typeof rows)[number]) => {
    if (row.value === CREATE_VALUE) {
      onCreate?.(text.trim())
    } else {
      onChange(row.value)
    }
    setQuery(null)
    setOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex(i => Math.min(i + 1, Math.max(rows.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // preventDefault unconditionally while open, even with no matching
      // row (an empty "Tidak ada hasil" state, or a shrunk `rows` after a
      // live update) - the combobox owns Enter for as long as its listbox
      // is open, per this component's own contract; only commit if there's
      // actually a row at activeIndex.
      if (open) {
        e.preventDefault()
        if (rows[activeIndex]) commit(rows[activeIndex])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        // Stop this Escape from also reaching a host modal <dialog> (which
        // treats an uncancelled Escape keydown as a close request) - the
        // first Escape closes only the listbox, matching APG and what a
        // user expects; a second Escape (nothing left open here) then
        // reaches the dialog normally.
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery(null)
      }
    }
  }

  const activeId = open && rows[activeIndex] ? `${listboxId}-${activeIndex}` : undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[14px] font-medium text-ink">{label}</label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onFocus={() => {
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current)
              blurTimeoutRef.current = null
            }
            setOpen(true)
            setActiveIndex(-1)
          }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(0) }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Deferred so a click on a listbox option (which blurs the
            // input first) still registers before the listbox unmounts.
            blurTimeoutRef.current = setTimeout(() => {
              blurTimeoutRef.current = null
              setOpen(false)
              setQuery(null)
            }, 150)
          }}
          className={`h-[var(--field-h)] w-full rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink disabled:text-ink-disabled ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
        />
        {open && (
          <ul id={listboxId} role="listbox" className="absolute z-dropdown mt-1 max-h-60 w-full overflow-y-auto rounded-field border border-border bg-surface shadow-panel">
            {rows.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-ink-muted">Tidak ada hasil.</li>
            ) : (
              rows.map((row, index) => (
                <li
                  key={row.value}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  // onMouseDown (not onClick): fires before the input's
                  // onBlur, so the click is not lost to the blur-driven close.
                  onMouseDown={e => { e.preventDefault(); commit(row) }}
                  className={`cursor-pointer px-3 py-2 text-[14px] ${index === activeIndex ? 'bg-mint-tint text-ink' : 'text-ink'}`}
                >
                  {row.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}
