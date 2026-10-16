import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { popOpenDialog, pushOpenDialog } from './dialogStack'
import { IconButton } from './IconButton'
import { matchesNow, TOUCH_PRIMARY } from './useMediaQuery'

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
  side: 'inset-x-0 top-auto bottom-0 w-full max-h-[85dvh] rounded-t-sheet md:inset-y-0 md:top-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:w-panel md:max-h-none md:rounded-t-none md:rounded-l-sheet',
  center: 'inset-0 m-auto h-fit max-h-[85dvh] w-[min(92vw,480px)] rounded-sheet',
}

/** Dragging the handle down this far (px), or flicking faster than this (px/ms), closes a bottom sheet. */
const DISMISS_DISTANCE = 96
const DISMISS_VELOCITY = 0.5

const BUANG_ISIAN = 'Tutup tanpa menyimpan? Isian yang sudah diketik akan hilang.'

const FIRST_FIELD =
  '[data-sheet-body] input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([disabled]), [data-sheet-body] select:not([disabled]), [data-sheet-body] textarea:not([disabled]), [data-sheet-body] button[role="combobox"]:not([disabled])'

/**
 * showModal() focuses the first focusable element, which is the Tutup button
 * in the header. A person opening a form wants to type, so focus goes to the
 * first field instead (a sheet with no field, like a menu of links, keeps the
 * browser's default). Not on a phone or tablet: there a focused field throws
 * the on-screen keyboard over half the sheet before the person has read it,
 * and a searchable picker as first field would also drop its list open in the
 * middle of the slide-in. They tap the field they want instead.
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
  // Whether anything was typed since the sheet opened: a swipe or a tap on the
  // scrim is easy to make by accident, so neither throws typed work away unasked.
  const diketik = useRef(false)
  // The scrim closes the sheet only for a press that also started on it, not
  // for a text selection dragged out of a field and released over it.
  const tekanDiScrim = useRef(false)
  const tarik = useRef<{ awalY: number; dy: number; lastY: number; lastT: number; v: number } | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      diketik.current = false
      dialog.showModal()
      pushOpenDialog(dialog)
      if (!matchesNow(TOUCH_PRIMARY)) focusFirstField(dialog)
    }
    if (!open && dialog.open) {
      dialog.close()
      popOpenDialog(dialog)
      // A swipe leaves the sheet parked below the screen through inline style;
      // the closed state's own transform is the same spot, so nothing jumps.
      dialog.style.removeProperty('transform')
      dialog.style.removeProperty('transition')
    }
  }, [open])

  /** A close the person did not ask for with a button: asks first when it would discard typing. */
  const tutupLewatGestur = (): boolean => {
    if (diketik.current && !window.confirm(BUANG_ISIAN)) return false
    onClose()
    return true
  }

  // Swipe down on the handle or header to close a bottom sheet (phone only:
  // from md up the side variant is a drawer, and the center one has no handle).
  const mulaiTarik = (e: PointerEvent<HTMLDivElement>) => {
    const dialog = ref.current
    if (!dialog || variant !== 'side' || e.pointerType === 'mouse') return
    if ((e.target as Element).closest('button') || matchesNow('(min-width: 768px)')) return
    tarik.current = { awalY: e.clientY, dy: 0, lastY: e.clientY, lastT: e.timeStamp, v: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dialog.style.transition = 'none'
  }

  const geserTarik = (e: PointerEvent<HTMLDivElement>) => {
    const t = tarik.current
    const dialog = ref.current
    if (!t || !dialog) return
    const dt = e.timeStamp - t.lastT
    if (dt > 0) t.v = (e.clientY - t.lastY) / dt
    t.lastY = e.clientY
    t.lastT = e.timeStamp
    t.dy = Math.max(0, e.clientY - t.awalY)
    dialog.style.transform = `translateY(${t.dy}px)`
  }

  const selesaiTarik = (batal: boolean) => {
    const t = tarik.current
    const dialog = ref.current
    tarik.current = null
    if (!t || !dialog) return
    dialog.style.removeProperty('transition')
    if (!batal && (t.dy > DISMISS_DISTANCE || t.v > DISMISS_VELOCITY) && tutupLewatGestur()) {
      dialog.style.transform = 'translateY(100%)'
      return
    }
    // Springs back through the open state's own transition.
    dialog.style.removeProperty('transform')
  }

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
      onInput={() => { diketik.current = true }}
      // The dialog box is covered edge to edge by its panel, so a press whose
      // target is the dialog itself landed on the scrim (::backdrop) around it.
      onPointerDown={e => { tekanDiScrim.current = e.target === e.currentTarget }}
      onClick={e => {
        if (e.target === e.currentTarget && tekanDiScrim.current) tutupLewatGestur()
        tekanDiScrim.current = false
      }}
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
        {/* The grab area: handle and header. touch-none so a drag here moves
            the sheet instead of scrolling or pulling the page to refresh. */}
        <div
          data-sheet-grab=""
          onPointerDown={mulaiTarik}
          onPointerMove={geserTarik}
          onPointerUp={() => selesaiTarik(false)}
          onPointerCancel={() => selesaiTarik(true)}
          className={`shrink-0 ${variant === 'side' ? 'touch-none md:touch-auto' : ''}`}
        >
          {variant === 'side' && (
            <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 rounded-pill bg-border-strong md:hidden" />
          )}
          <div className="flex items-center justify-between gap-4 border-b border-border pl-5 pr-3 py-2.5">
            <h2 id={titleId} className="text-lg font-semibold text-ink">{title}</h2>
            <IconButton icon={X} label="Tutup" variant="secondary" onClick={onClose} />
          </div>
        </div>
        <div data-sheet-body className="flex flex-1 flex-col overflow-y-auto overscroll-contain p-4 scroll-pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>,
    document.body,
  )
}
