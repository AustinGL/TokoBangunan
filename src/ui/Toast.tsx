import { useCallback, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext } from './useToast'
import { topOpenDialog } from './dialogStack'

type ToastItem = { id: string; message: string }

const TOAST_DURATION_MS = 4000

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
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS)
  }, [])

  const region = (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-toast flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className="glass-strong rounded-tile px-4 py-3 text-[14px] text-ink shadow-panel">
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
