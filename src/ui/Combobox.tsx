import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { Icon } from './Icon'
import { ListboxPanel } from './ListboxPanel'
import { optionId, type ListboxRow } from './listbox'
import { DEFAULT_PLACEMENT, measurePlacement, type PanelPlacement } from './panelPlacement'

export type ComboboxOption = { value: string; label: string; hint?: string }

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
  required?: boolean
}

const CREATE_VALUE = '__create__'

export function Combobox({ id, label, options, value, onChange, onCreate, placeholder, error, disabled, required }: Props) {
  const listboxId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
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
  const [placement, setPlacement] = useState<PanelPlacement>(DEFAULT_PLACEMENT)

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''
  const text = query ?? selectedLabel

  const normalizedText = text.trim().toLowerCase()
  // Filter by what the user is typing, never by the chosen option's own
  // label: reopening a field that already holds a choice must list every
  // option, or the chevron would offer a one-item list with no way to switch.
  const typedText = (query ?? '').trim().toLowerCase()
  const filtered = useMemo(
    () => (typedText === '' ? options : options.filter(o => o.label.toLowerCase().includes(typedText))),
    [options, typedText],
  )
  const exactMatch = options.some(o => o.label.toLowerCase() === normalizedText)
  const showCreateRow = Boolean(onCreate) && text.trim() !== '' && !exactMatch
  const rows: ListboxRow[] = showCreateRow
    ? [...filtered, { value: CREATE_VALUE, label: `Tambah "${text.trim()}"`, kind: 'create' }]
    : filtered

  // Measured when the list goes from closed to open, from an event handler
  // (never during render), so a field at the bottom of a Sheet opens upward.
  const openList = () => {
    if (!open) setPlacement(measurePlacement(wrapperRef.current))
    setOpen(true)
  }

  const closeList = () => {
    setOpen(false)
    setQuery(null)
  }

  const toggleList = () => {
    if (disabled) return
    if (open) {
      closeList()
      return
    }
    // Focusing opens the list via onFocus; openList covers an input that
    // already had focus (e.g. after Escape closed the list).
    inputRef.current?.focus()
    openList()
  }

  const commit = (row: ListboxRow) => {
    if (row.kind === 'create') {
      onCreate?.(text.trim())
    } else {
      onChange(row.value)
    }
    closeList()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      openList()
      setActiveIndex(i => Math.min(i + 1, Math.max(rows.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      openList()
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
        closeList()
      }
    }
  }

  const activeId = open && rows[activeIndex] ? optionId(listboxId, activeIndex) : undefined

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={`text-[14px] font-medium text-ink ${required ? 'req' : ''}`}>{label}</label>
      <div ref={wrapperRef} className="relative">
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          aria-required={required ? true : undefined}
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onFocus={() => {
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current)
              blurTimeoutRef.current = null
            }
            openList()
            setActiveIndex(-1)
          }}
          onChange={e => { setQuery(e.target.value); openList(); setActiveIndex(0) }}
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
          className={`h-control w-full rounded-field border bg-[var(--field-bg)] pl-3 pr-11 text-[14px] text-ink disabled:text-ink-disabled ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
        />
        {!disabled && (
          // Mouse and touch only: the input is the one focusable control, and
          // keyboard users open the list with ArrowDown. mousedown (with
          // preventDefault) so the input keeps focus.
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onMouseDown={e => { e.preventDefault(); toggleList() }}
            className="absolute inset-y-0 right-0 flex w-control items-center justify-center text-ink-muted"
          >
            <Icon icon={ChevronDown} size="button" className={`transition-transform duration-quick ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
        {open && (
          <ListboxPanel
            id={listboxId}
            rows={rows}
            activeIndex={activeIndex}
            selectedValue={value}
            emptyText="Tidak ada hasil."
            placement={placement}
            highlight={query ?? ''}
            onPick={commit}
          />
        )}
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}
