import type { ReactNode } from 'react'

type Props = { title: string; subtitle?: ReactNode; action?: ReactNode }

/** The one `h1` of a screen, with an optional muted subtitle and an action (usually the primary button). */
export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-bold leading-7 text-ink">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
