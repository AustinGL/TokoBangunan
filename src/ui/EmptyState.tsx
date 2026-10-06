import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { IconTile } from './IconTile'

type Props = { icon: LucideIcon; children: ReactNode; action?: ReactNode }

/** A composed empty state: icon, one plain sentence, and (only when cheap) one action. No card around it: it sits on the page like Apple's "content unavailable". */
export function EmptyState({ icon, children, action }: Props) {
  return (
    <div className="card-in flex min-h-60 flex-col items-center justify-center gap-4 rounded-card bg-surface px-6 py-12 text-center shadow-card">
      <IconTile icon={icon} tone="neutral" />
      <p className="max-w-md text-sm leading-6 text-ink-muted">{children}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
