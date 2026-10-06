import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { popOpenDialog, pushOpenDialog } from './dialogStack'
import { IconButton } from './IconButton'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /**
   * 'side': a bottom sheet on phone (<768px), a right-hand drawer on md and
   * up. 'center': a smaller centered panel for shorter content (a confirm,
   * a short form). Defaults to 'side'.
   */
  variant?: 'side' | 'center'
}

const VARIANT_POSITION: Record<NonNullable<Props['variant']>, string> = {
  side: 'inset-x-0 top-auto bottom-0 w-full max-h-[85vh] rounded-t-sheet md:inset-y-0 md:top-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:w-panel md:max-h-none md:rounded-t-none md:rounded-l-sheet',
  center: 'inset-0 m-auto h-fit max-h-[85vh] w-[min(92vw,480px)] rounded-sheet',
}

const FIRST_FIELD =
  '[data-sheet-body] input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), [data-sheet-body] select:not([disabled]), [data-sheet-body] textarea:not([disabled]), [data-sheet-body] button[role="combobox"]:not([disabled])'

/**
 * showModal() focuses the first focusable element, which is the Tutup button
 * in the header. A person opening a form wants to type, so focus goes to the
 * first field instead (a sheet with no field, like a menu of links, keeps the
 * browser's default).
 */
function focusFirstField(dialog: HTMLDialogElement): void {
  dialog.querySelector<HTMLElement>(FIRST_FIELD)?.focus()
}

/**
 * A native <dialog> shown with showModal(): focus trapping, Escape-to-close
 * and returning focus to the trigger all come from the browser for free
 * rather than being hand-rolled. jsdom does not implement
 * HTMLDialogElement.showModal/close/show at all (see the polyfill
 * src/test-setup.ts registers, and its own doc comment for what was
 * verified before writing it).
 *
 * Motion lives in tokens.css (dialog[data-sheet]): the sheet slides up from
 * the bottom on phones, in from the right on desktop, and scales in when
 * centered, with the scrim fading alongside. Both entry and exit animate
 * through @starting-style and allow-discrete; a browser without them simply
 * opens and closes instantly.
 */
export function Sheet({ open, onClose, title, children, variant = 'side' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) { dialog.showModal(); pushOpenDialog(dialog); focusFirstField(dialog) }
    if (!open && dialog.open) { dialog.close(); popOpenDialog(dialog) }
  }, [open])

  // After a submit that failed validation with a single error there is no
  // error summary to receive focus, so focus would stay on the Simpan button
  // while the message sits, unseen by a screen reader, under a field. Move it
  // to the first invalid field. Skipped when a form already moved focus
  // itself (its multi-error summary): then focus is no longer on a button.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onSubmit = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (!dialog.contains(active) || active?.tagName !== 'BUTTON') return
        dialog.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
    }
    dialog.addEventListener('submit', onSubmit)
    return () => dialog.removeEventListener('submit', onSubmit)
  }, [])

  // Separate from the effect above (which only reacts to `open` changing):
  // a Sheet that unmounts while still open (its own parent stops rendering
  // it) would otherwise leave a stale entry in the shared dialog stack
  // forever, since the effect above never gets a chance to run its `!open`
  // branch in that case.
  useEffect(() => {
    const dialog = ref.current
    return () => { if (dialog) popOpenDialog(dialog) }
  }, [])

  // Rendered through a portal into document.body, never in place. A picker's
  // inline "Tambah ..." opens a Sheet from inside a caller's <form> (Tambah
  // stok); left in place, the sheet's own <form> would be nested in that one at
  // the DOM level, and Chrome never bubbles a submit event from a nested form
  // up to React's root listener. The sheet's onSubmit would not run, the
  // browser would submit the form natively and navigate away ("/stok?"),
  // saving nothing. jsdom does not reproduce that; e2e/list-pages.spec.ts does.
  return createPortal(
    <dialog
      ref={ref}
      data-sheet=""
      data-variant={variant}
      // React events still bubble through the component tree across a portal,
      // so a submit inside the sheet would reach the caller's <form> onSubmit
      // (its validation over fields the user is not editing). The sheet is a
      // modal boundary: submits stay inside it.
      onSubmit={e => e.stopPropagation()}
      // dialog.close() above (a parent-driven close, e.g. after the header
      // button already called onClose once) fires this same native `close`
      // event that Escape triggers, so onClose can run a second time for one
      // logical close. Harmless as long as onClose stays idempotent (a
      // plain setState to false), which is what every caller in this
      // codebase does.
      onClose={onClose}
      aria-labelledby={titleId}
      // No unconditional max-h-none here: browsers already give <dialog> a
      // native UA-stylesheet max-height, but author-origin styles (any of
      // our own classes) always beat that regardless of specificity, so
      // each variant's own max-h-[85vh] (and the side variant's md:max-h-none
      // for its desktop full-height case) already fully override it. Adding
      // an unprefixed max-h-none here would instead defeat those same caps:
      // Tailwind compiles .max-h-none after .max-h-[85vh] in this project's
      // build, so two classes of equal specificity on one element cascade by
      // that compiled order, not by their order in this string - verified in
      // Sheet.test.tsx.
      className={`fixed m-0 max-w-none border-0 bg-transparent p-0 open:flex open:flex-col ${VARIANT_POSITION[variant]}`}
    >
      {/* The sheet itself is solid: translucency is for the navigation layer only. */}
      <div className="flex h-full flex-col overflow-hidden bg-surface shadow-panel">
        {variant === 'side' && (
          <span aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-pill bg-border-strong md:hidden" />
        )}
        <div className="flex items-center justify-between gap-4 border-b border-border pl-5 pr-3 py-2.5">
          <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
          <IconButton icon={X} label="Tutup" variant="secondary" onClick={onClose} />
        </div>
        <div data-sheet-body className="flex flex-1 flex-col overflow-y-auto p-4 scroll-pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>,
    document.body,
  )
}
