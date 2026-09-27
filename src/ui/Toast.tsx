import { useCallback, useState, type ReactNode } from 'react'
import { ToastContext } from './useToast'

type ToastItem = { id: string; message: string }

const TOAST_DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-toast flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className="glass-strong rounded-tile px-4 py-3 text-[14px] text-ink shadow-panel">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
