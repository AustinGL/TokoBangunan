import { Fragment, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { Icon } from './Icon'
import { measureGeser, measureSide } from './panelPlacement'
import { usePresence } from './usePresence'

type Props = {
  id: string
  label: string
  /** Keep the label for assistive tech but do not draw it. */
  hideLabel?: boolean
  required?: boolean
  error?: string
  disabled?: boolean
  variant?: 'field' | 'pill'
  /** What the field shows, and whether that is only a placeholder. */
  teks: string
  kosong: boolean
  /** Card height and width in px, for choosing which way it opens. */
  tinggi?: number
  lebar?: number
  onBuka?: () => void
  /** Runs whenever the card closes, however it closes, so a half-made choice can be dropped. */
  onTutup?: () => void
  /** The card's content; `tutup()` closes it and returns focus to the field. */
  children: (tutup: () => void) => ReactNode
}

/**
 * The shared field and floating card of the date pickers. The field is a
 * button (no typing a date); the card is placed like the dropdown panels (down,
 * or up when it does not fit; left edge or right edge so it never runs off the
 * screen) and animates the same way. Escape closes only the card, a press
 * outside or Tab out closes it too.
 */
export function PickerPopup({
  id, label, hideLabel, required, error, disabled, variant = 'field', teks, kosong,
  tinggi = 400, lebar = 332, onBuka, onTutup, children,
}: Props) {
  const popupId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const kartuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [sisi, setSisi] = useState<'down' | 'up'>('down')
  const [geser, setGeser] = useState(0)
  // Counts openings, so a card reopened while the last one is still playing its exit animation starts fresh.
  const [nomorBuka, setNomorBuka] = useState(0)
  const { mounted, closing } = usePresence(open)

  const tutupTanpaFokus = useCallback(() => {
    setOpen(false)
    onTutup?.()
  }, [onTutup])

  const buka = () => {
    if (disabled) return
    setSisi(measureSide(wrapperRef.current, tinggi))
    setGeser(measureGeser(wrapperRef.current, lebar))
    setNomorBuka(n => n + 1)
    onBuka?.()
    setOpen(true)
  }

  // Looked up by id rather than through triggerRef: this is handed to the card's content, which is rendered
  // here, and a render must not touch a ref.
  const tutup = () => {
    tutupTanpaFokus()
    document.getElementById(id)?.focus()
  }

  // A card taller than the room above or below the field (a phone, or the bottom of a sheet) would be cut off:
  // bring it into view. Done once its entry animation (96% scale to 100%) has finished, or its box is measured
  // a few pixels short and the scroll stops short too; the card's scroll margin leaves breathing room.
  // scrollIntoView and getAnimations do not exist in jsdom, hence the typeof guards.
  useEffect(() => {
    if (!open) return
    const kartu = kartuRef.current
    if (!kartu || typeof kartu.scrollIntoView !== 'function') return
    const gulir = () => kartu.scrollIntoView({ block: 'nearest' })
    const animasi = typeof kartu.getAnimations === 'function' ? kartu.getAnimations() : []
    if (animasi.length === 0) { gulir(); return }
    let batal = false
    Promise.all(animasi.map(a => a.finished)).then(() => { if (!batal) gulir() }, () => {})
    return () => { batal = true }
  }, [open])

  // A press anywhere outside closes the card. (Focus alone is not enough: Safari does not focus buttons on click.)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) tutupTanpaFokus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, tutupTanpaFokus])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (open && e.key === 'Escape') {
      // Like Select and Combobox: the first Escape closes only the card, so a host <dialog> does not treat it as its own close request.
      e.preventDefault()
      e.stopPropagation()
      tutup()
    }
  }

  const triggerClass =
    variant === 'pill'
      ? 'flex h-control items-center gap-2 rounded-pill border border-border-input bg-surface px-4 text-sm font-semibold text-ink transition-colors duration-quick enabled:hover:border-ink-muted enabled:hover:bg-surface-card disabled:cursor-not-allowed disabled:bg-surface-card disabled:text-ink-disabled'
      : `flex h-control w-full items-center justify-between gap-2 rounded-field border bg-[var(--field-bg)] px-3 text-left text-sm text-ink transition-[border-color,background-color] duration-quick enabled:hover:border-ink-muted disabled:cursor-not-allowed disabled:bg-surface-card disabled:text-ink-disabled ${
          error ? 'border-danger' : 'border-[var(--field-bd)]'
        }`

  return (
    <div className={variant === 'pill' ? 'inline-flex flex-col' : 'flex flex-col gap-1'}>
      {variant === 'field' && !hideLabel ? (
        <label id={`${id}-label`} htmlFor={id} className={`text-sm font-medium text-ink ${required ? 'req' : ''}`}>{label}</label>
      ) : (
        <span id={`${id}-label`} className="sr-only">{label}</span>
      )}
      <div
        ref={wrapperRef} className="relative" onKeyDown={onKeyDown}
        onBlur={e => {
          const ke = e.relatedTarget as Node | null
          if (open && ke && !wrapperRef.current?.contains(ke)) tutupTanpaFokus()
        }}
      >
        <button
          id={id} ref={triggerRef} type="button"
          aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
          aria-labelledby={`${id}-label ${id}-value`}
          aria-invalid={error ? true : undefined}
          aria-required={required ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={disabled}
          onClick={() => { if (open) tutup(); else buka() }}
          className={triggerClass}
        >
          <span id={`${id}-value`} className={`min-w-0 flex-1 truncate ${kosong ? 'text-[var(--field-placeholder)]' : ''}`}>{teks}</span>
          <Icon icon={CalendarDays} size="button" className="shrink-0 text-ink-muted" />
        </button>
        {mounted && (
          <div
            id={popupId} ref={kartuRef} role="dialog" aria-label={`Kalender ${label}`}
            aria-hidden={closing || undefined} inert={closing}
            className={`${closing ? 'listbox-out' : 'listbox-in'} absolute z-dropdown w-max max-w-[calc(100vw-1rem)] scroll-my-6 rounded-card bg-surface p-3 shadow-float ${
              sisi === 'up' ? 'listbox-up bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
            style={{ left: geser }}
          >
            <Fragment key={nomorBuka}>{children(tutup)}</Fragment>
          </div>
        )}
      </div>
      {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  )
}
