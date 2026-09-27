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
  const [text, setText] = useState(() => options.find(o => o.value === value)?.label ?? '')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  // Tracks the last value we synced text from, so an external change to
  // `value` (including to null, which clears the field) is applied during
  // render rather than in an effect - React's own documented pattern for
  // "adjusting state when a prop changes" - without clobbering the user's
  // own in-progress typing on every render.
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(options.find(o => o.value === value)?.label ?? '')
  }

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
      if (open && rows[activeIndex]) {
        e.preventDefault()
        commit(rows[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      const selected = options.find(o => o.value === value)
      setText(selected?.label ?? '')
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
          onFocus={() => { setOpen(true); setActiveIndex(0) }}
          onChange={e => { setText(e.target.value); setOpen(true); setActiveIndex(0) }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Deferred so a click on a listbox option (which blurs the
            // input first) still registers before the listbox unmounts.
            setTimeout(() => {
              setOpen(false)
              const selected = options.find(o => o.value === value)
              setText(selected?.label ?? '')
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
