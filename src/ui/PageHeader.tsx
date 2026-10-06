import type { ReactNode } from 'react'

type Props = { title: string; subtitle?: ReactNode; action?: ReactNode }

/**
 * The one `h1` of a screen: a Large Title with an optional muted subtitle and
 * an action (usually the primary button).
 */
export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <header className="flex min-h-16 flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-2">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
