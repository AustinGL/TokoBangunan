import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext } from './useToast'
import { topOpenDialog } from './dialogStack'

type ToastItem = { id: string; message: string; leaving: boolean }

const TOAST_DURATION_MS = 4000
const TOAST_EXIT_MS = 160

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [portalTarget, setPortalTarget] = useState<HTMLElement>(() => document.body)

  const showToast = useCallback((message: string) => {
    // A plain fixed div rendered as a sibling of an open Sheet is invisible:
    // the Sheet's <dialog> uses showModal(), which puts it in the browser's
    // top layer, painting above everything else regardless of z-index. A
    // popover doesn't fix this either - verified directly against Chromium,
    // a modal dialog always paints above a popover regardless of which was
    // shown more recently (see dialogStack.ts). Portaling the toast INTO
    // the currently open dialog, as a plain DOM descendant, paints it above
    // that dialog's own content by ordinary stacking rules instead.
    setPortalTarget(topOpenDialog() ?? document.body)
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, leaving: false }])
    // Two steps so the exit can play: mark it leaving, then remove it.
    setTimeout(() => setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t))), TOAST_DURATION_MS)
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS + TOAST_EXIT_MS)
  }, [])

  // A capsule that drops in from the top edge on a bouncy spring and lifts
  // away again, like a system HUD. The live region stays mounted so a
  // screen reader hears each message as it arrives.
  const region = (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+12px)] z-toast flex flex-col items-center gap-2 px-4"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${t.leaving ? 'toast-out' : 'toast-in'} max-w-[min(92vw,420px)] rounded-pill bg-focal px-5 py-3 text-center text-sm font-medium text-focal-fg shadow-panel`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(region, portalTarget)}
    </ToastContext.Provider>
  )
}
