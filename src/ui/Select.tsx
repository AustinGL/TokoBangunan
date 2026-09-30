import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { Icon } from './Icon'
import { ListboxPanel } from './ListboxPanel'
import { optionId, type ListboxRow } from './listbox'
import { DEFAULT_PLACEMENT, measurePlacement, type PanelPlacement } from './panelPlacement'

export type SelectOption = { value: string; label: string; hint?: string; disabled?: boolean }

type Props = {
  id: string
  /** `field`: the visible label above the trigger. `pill`: the prefix that names the pill for assistive tech ("Kategori"); it is not drawn, the value says what it filters. */
  label: string
  options: SelectOption[]
  value: string | null
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  disabled?: boolean
  required?: boolean
  variant?: 'field' | 'pill'
  /** Field variant only: keep the label for assistive tech but do not draw it. */
  hideLabel?: boolean
  /** Pill variant: the value that means "no filter"; any other chosen value tints the pill. */
  neutralValue?: string
}

const TYPEAHEAD_RESET_MS = 500

/**
 * Select-only combobox (WAI-ARIA APG): a button that opens a listbox, for the
 * short fixed lists a native <select> used to serve. The value lives in React
 * state, so there is no hidden input. Same panel as Combobox.
 */
export function Select({
  id, label, options, value, onChange, placeholder = 'Pilih...', error, disabled, required,
  variant = 'field', hideLabel, neutralValue,
}: Props) {
  const listboxId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [placement, setPlacement] = useState<PanelPlacement>(DEFAULT_PLACEMENT)

  const selectedIndex = options.findIndex(o => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  /** Next enabled option after `from` in direction `dir`, or null if there is none. */
  const nextEnabled = (from: number, dir: 1 | -1): number | null => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i
    }
    return null
  }

  const openList = () => {
    if (disabled) return
    setPlacement(measurePlacement(wrapperRef.current))
    // Safari does not focus a button on click; without focus the blur-driven
    // close would never fire for a click outside.
    triggerRef.current?.focus()
    // Start on the chosen option, else the first enabled one, so Enter works at once.
    setActiveIndex(
      selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : (nextEnabled(-1, 1) ?? -1),
    )
    setOpen(true)
  }

  const commit = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  /** Index of the first enabled option starting with what was typed in the last 500ms, or -1. */
  const findByTyping = (char: string): number => {
    const now = Date.now()
    const fresh = now - typed.current.at > TYPEAHEAD_RESET_MS
    typed.current = { text: fresh ? char : typed.current.text + char, at: now }
    const needle = typed.current.text.toLowerCase()
    return options.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(needle))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    const isTyping = e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        openList()
      } else if (isTyping) {
        e.preventDefault()
        openList()
        const hit = findByTyping(e.key)
        if (hit >= 0) setActiveIndex(hit)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = nextEnabled(activeIndex, 1)
      if (next !== null) setActiveIndex(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = nextEnabled(activeIndex, -1)
      if (prev !== null) setActiveIndex(prev)
    } else if (e.key === 'Home') {
      e.preventDefault()
      const first = nextEnabled(-1, 1)
      if (first !== null) setActiveIndex(first)
    } else if (e.key === 'End') {
      e.preventDefault()
      const last = nextEnabled(options.length, -1)
      if (last !== null) setActiveIndex(last)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      commit(activeIndex)
    } else if (e.key === 'Escape') {
      // Same rule as Combobox: the first Escape closes only the list, so a
      // host <dialog> does not treat it as its own close request.
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (isTyping) {
      e.preventDefault()
      const hit = findByTyping(e.key)
      if (hit >= 0) setActiveIndex(hit)
    }
  }

  const tinted = variant === 'pill' && selected !== undefined && selected.value !== neutralValue
  const valueText = selected?.label ?? placeholder

  const triggerClass =
    variant === 'pill'
      ? `flex h-control items-center gap-2 rounded-pill border px-4 text-[13px] font-semibold transition-colors duration-quick disabled:text-ink-disabled ${
          tinted ? 'border-primary bg-accent-50 text-primary' : 'border-border-input bg-surface text-ink'
        }`
      : `flex h-control w-full items-center justify-between gap-2 rounded-field border bg-[var(--field-bg)] px-3 text-left text-[14px] text-ink disabled:text-ink-disabled ${
          error ? 'border-danger' : 'border-[var(--field-bd)]'
        }`

  return (
    <div className={variant === 'pill' ? 'inline-flex flex-col' : 'flex flex-col gap-1'}>
      {variant === 'field' && (
        <label
          htmlFor={id}
          className={`text-[14px] font-medium text-ink ${required ? 'req' : ''} ${hideLabel ? 'sr-only' : ''}`}
        >
          {label}
        </label>
      )}
      <div ref={wrapperRef} className="relative">
        <button
          id={id}
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && activeIndex >= 0 ? optionId(listboxId, activeIndex) : undefined}
          // A combobox does not take its name from its content, so the pill
          // names itself from its two visible parts.
          aria-labelledby={variant === 'pill' ? `${id}-prefix ${id}-value` : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={disabled}
          onClick={() => { if (open) setOpen(false); else openList() }}
          onKeyDown={handleKeyDown}
          // A held Space fires click on keyup in some browsers; keydown already handled it.
          onKeyUp={e => { if (e.key === ' ') e.preventDefault() }}
          onBlur={() => setOpen(false)}
          className={triggerClass}
        >
          {variant === 'pill' && (
            <span id={`${id}-prefix`} className="sr-only">{label}</span>
          )}
          <span
            id={`${id}-value`}
            className={`min-w-0 flex-1 truncate ${variant === 'pill' ? 'max-w-[12rem]' : ''} ${
              selected ? '' : 'text-[var(--field-placeholder)]'
            }`}
          >
            {valueText}
          </span>
          <Icon
            icon={ChevronDown}
            size="button"
            className={`shrink-0 transition-transform duration-quick ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <ListboxPanel
            id={listboxId}
            rows={options as ListboxRow[]}
            activeIndex={activeIndex}
            selectedValue={value}
            emptyText="Tidak ada pilihan."
            placement={placement}
            className={variant === 'pill' ? 'w-max min-w-full max-w-[min(20rem,90vw)]' : 'w-full'}
            onPick={row => commit(options.findIndex(o => o.value === row.value))}
          />
        )}
      </div>
      {error && <p id={`${id}-error`} className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}
