import type { LucideIcon } from 'lucide-react'
import { IconTile, type IconTone } from './IconTile'

type Props = {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: IconTone
  /** Given: the tile is a toggle button. Omitted: a plain figure. */
  onClick?: () => void
  pressed?: boolean
  className?: string
}

const BASE =
  'flex min-h-tap min-w-0 flex-col items-start gap-2 rounded-card border p-3 text-left md:flex-row md:items-center md:gap-3 md:p-4'

/**
 * An icon, a big tabular number and a label. As a button it is a status
 * filter: pressed = the active one. Meaning is in the label and number; the
 * icon and tint only reinforce it.
 */
export function StatTile({ label, value, icon, tone = 'neutral', onClick, pressed = false, className = '' }: Props) {
  const body = (
    <>
      <IconTile icon={icon} tone={tone} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="break-words text-[22px] font-bold leading-7 tabular-nums text-ink">{value}</span>
        <span className="text-[13px] leading-4 text-ink-muted">{label}</span>
      </span>
    </>
  )

  if (!onClick) {
    return <div className={`${BASE} border-border bg-surface shadow-card ${className}`}>{body}</div>
  }

  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`${label}: ${value}`}
      onClick={onClick}
      className={`${BASE} transition-colors duration-instant active:scale-[0.98] ${
        pressed ? 'border-primary bg-accent-50' : 'border-border bg-surface shadow-card hover:bg-[var(--table-row-hover)]'
      } ${className}`}
    >
      {body}
    </button>
  )
}
