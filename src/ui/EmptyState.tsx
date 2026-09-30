import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { IconTile } from './IconTile'

type Props = { icon: LucideIcon; children: ReactNode; action?: ReactNode }

/** A composed empty state: icon, one plain sentence, and (only when cheap) one action. */
export function EmptyState({ icon, children, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface px-6 py-10 text-center">
      <IconTile icon={icon} />
      <p className="max-w-sm text-[14px] text-ink-muted">{children}</p>
      {action}
    </div>
  )
}
