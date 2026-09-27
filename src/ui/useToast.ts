import { createContext, useContext } from 'react'

export type ToastContextValue = { showToast: (message: string) => void }

// Split from Toast.tsx: react-refresh/only-export-components forbids a
// component file from also exporting a plain hook - same precedent as
// features/kasir/useProductCatalog.ts's split from its component file.
export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider.')
  return ctx
}
