import type { LucideIcon } from 'lucide-react'
import { Icon as AppIcon } from './Icon'

export type IconTone = 'neutral' | 'primary' | 'warning' | 'danger'

const TONE: Record<IconTone, string> = {
  neutral: 'bg-neutral-bg text-neutral',
  primary: 'bg-accent-50 text-primary-ink',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
}

type Props = { icon: LucideIcon; tone?: IconTone; size?: 'md' | 'sm'; className?: string }

/** A tinted icon holder. Purely decorative: the words next to it carry the meaning. */
export function IconTile({ icon: Glyph, tone = 'neutral', size = 'md', className = '' }: Props) {
  const box = size === 'sm' ? 'size-9 rounded-[10px]' : 'size-10 rounded-inner'
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${box} ${TONE[tone]} ${className}`}>
      <AppIcon icon={Glyph} size={size === 'sm' ? 'button' : 'nav'} />
    </span>
  )
}
