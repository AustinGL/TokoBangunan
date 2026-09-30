import type { LucideIcon } from 'lucide-react'

export type IconTone = 'neutral' | 'primary' | 'warning' | 'danger'

const TONE: Record<IconTone, string> = {
  neutral: 'bg-neutral-bg text-neutral',
  primary: 'bg-accent-50 text-primary',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
}

type Props = { icon: LucideIcon; tone?: IconTone; size?: 'md' | 'sm'; className?: string }

/** A tinted icon holder. Purely decorative: the words next to it carry the meaning. */
export function IconTile({ icon: Icon, tone = 'neutral', size = 'md', className = '' }: Props) {
  const box = size === 'sm' ? 'size-9 rounded-full' : 'size-10 rounded-inner'
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${box} ${TONE[tone]} ${className}`}>
      <Icon size={size === 'sm' ? 18 : 20} />
    </span>
  )
}
