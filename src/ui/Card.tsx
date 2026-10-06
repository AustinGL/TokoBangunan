import type { CSSProperties, ReactNode } from 'react'

type Props = {
  title?: string
  /** Right side of the header row: a period dropdown, a link, an action. */
  action?: ReactNode
  children: ReactNode
  /** Small footer row: muted label left, link right. */
  footer?: ReactNode
  /** 'raised' is white (default), 'card' is the tonal gray, 'focal' is the one dark widget per screen. */
  tone?: 'raised' | 'card' | 'focal'
  className?: string
  /** Position in a mount stagger (30ms per step, capped at six). Omit for no entrance animation. */
  stagger?: number
  'aria-labelledby'?: string
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  raised: 'bg-surface shadow-card',
  card: 'bg-fill-tertiary',
  focal: 'bg-focal text-focal-fg',
}

/**
 * The base surface: a soft radius and a tonal fill, with header/body/footer
 * slots. No border and no drop shadow: hierarchy comes from tone steps.
 */
export function Card({ title, action, children, footer, tone = 'raised', className = '', stagger, ...rest }: Props) {
  const style = stagger === undefined ? undefined : ({ '--stagger': stagger } as CSSProperties)
  return (
    <section
      {...rest}
      style={style}
      className={`relative flex flex-col gap-3 overflow-hidden rounded-card p-4 md:p-5 ${TONE[tone]} ${stagger === undefined ? '' : 'card-in'} ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2">{children}</div>
      {footer && <div className="flex items-center justify-between gap-3 text-xs">{footer}</div>}
    </section>
  )
}
