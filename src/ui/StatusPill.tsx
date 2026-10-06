import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react'
import { Icon as AppIcon } from './Icon'

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral'

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-neutral-bg text-neutral',
}

const TONE_ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  neutral: MinusCircle,
} as const

/**
 * A status is never colour alone: every tone carries its own icon next to
 * the word (docs/REDESIGN.md section 3.3). The icon is decorative
 * (aria-hidden); the word is the accessible name.
 */
export function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const Glyph = TONE_ICON[tone]
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}>
      <AppIcon icon={Glyph} size="micro" />
      {children}
    </span>
  )
}
