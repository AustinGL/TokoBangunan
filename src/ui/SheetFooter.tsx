import type { ReactNode } from 'react'

/**
 * The action row of a form sheet: pinned to the bottom of the sheet while the
 * fields scroll behind it. Must be the last child of the sheet's <form> (so
 * submit and Enter keep working), and that form must be
 * `flex min-h-0 flex-1 flex-col`: mt-auto then parks the row at the sheet's
 * bottom even when the fields are short. -mx-4/-mb-4 cancel the sheet body's
 * padding so the bar spans the sheet's full width.
 */
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-sticky -mx-4 -mb-4 mt-auto flex items-center justify-between gap-3 border-t border-border bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}
