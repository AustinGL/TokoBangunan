import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

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
  side: 'inset-x-0 bottom-0 w-full max-h-[85vh] rounded-t-sheet md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:w-[420px] md:max-h-none md:rounded-t-none md:rounded-l-sheet',
  center: 'inset-0 m-auto h-fit max-h-[85vh] w-[min(92vw,480px)] rounded-sheet',
}

/**
 * A native <dialog> shown with showModal(): focus trapping, Escape-to-close
 * and returning focus to the trigger all come from the browser for free
 * rather than being hand-rolled. jsdom does not implement
 * HTMLDialogElement.showModal/close/show at all (see the polyfill
 * src/test-setup.ts registers, and its own doc comment for what was
 * verified before writing it).
 */
export function Sheet({ open, onClose, title, children, variant = 'side' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      // dialog.close() above (a parent-driven close, e.g. after the header
      // button already called onClose once) fires this same native `close`
      // event that Escape triggers, so onClose can run a second time for one
      // logical close. Harmless as long as onClose stays idempotent (a
      // plain setState to false), which is what every caller in this
      // codebase does.
      onClose={onClose}
      aria-labelledby={titleId}
      className={`fixed m-0 max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-[var(--scrim)] open:flex open:flex-col ${VARIANT_POSITION[variant]}`}
    >
      <div className="glass-strong flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border p-4">
          <h2 id={titleId} className="text-[15px] font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex min-h-tap min-w-tap items-center justify-center rounded-tile text-ink-muted"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <div className="scroll-region flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  )
}
