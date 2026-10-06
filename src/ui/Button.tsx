import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { LoaderCircle } from 'lucide-react'
import { Icon } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'md' | 'sm'

// Every button presses in (scale) and springs back on release; colour changes
// ease rather than snap.
const BASE =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap transition-[color,background-color,transform] duration-quick ease-spring active:scale-[0.97] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'rounded-pill bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-semibold hover:bg-primary-hover active:bg-primary-active',
  secondary: 'rounded-pill border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-fg)] font-semibold hover:bg-[rgba(120,120,128,.18)] active:bg-[rgba(120,120,128,.24)]',
  ghost: 'rounded-pill text-ink-muted font-medium hover:bg-fill hover:text-ink active:bg-[rgba(120,120,128,.18)]',
  danger: 'rounded-pill bg-danger-bg text-danger font-semibold hover:bg-danger hover:text-white active:brightness-90',
  link: 'rounded-tile text-primary-ink font-medium underline-offset-4 hover:underline active:opacity-70',
}

// sm is visually 36px but its ::before extends the hit area to 44px.
const SIZE: Record<ButtonSize, string> = {
  md: 'h-control px-5 text-sm',
  sm: "h-control-sm px-4 text-sm before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
}

// A text link is a hit area, not a box: it keeps a 44px floor instead of a fixed height.
const LINK_SIZE = 'min-h-tap min-w-tap px-1 text-sm'

// eslint-disable-next-line react-refresh/only-export-components -- shared class builder for Button, ButtonLink and callers; a plain function never breaks Fast Refresh here
export function buttonClass(variant: ButtonVariant, size: ButtonSize, fullWidth = false): string {
  const sizeClass = variant === 'link' ? LINK_SIZE : SIZE[size]
  return `${BASE} ${VARIANT[variant]} ${sizeClass}${fullWidth ? ' w-full' : ''}`
}

type Shared = { variant?: ButtonVariant; size?: ButtonSize; icon?: LucideIcon; fullWidth?: boolean }

export function Button({
  variant = 'secondary', size = 'md', icon, fullWidth, loading = false, loadingLabel = 'Memproses...',
  type = 'button', className, children, disabled, ...rest
}: Shared & ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode; loading?: boolean; loadingLabel?: string }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClass(variant, size, fullWidth)}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {loading ? <Icon icon={LoaderCircle} size="button" className="animate-spin" /> : icon && <Icon icon={icon} size="button" />}
      {loading ? loadingLabel : children}
    </button>
  )
}

export function ButtonLink({
  variant = 'secondary', size = 'md', icon, fullWidth, className, children, ...rest
}: Shared & LinkProps) {
  return (
    <Link className={`${buttonClass(variant, size, fullWidth)}${className ? ` ${className}` : ''}`} {...rest}>
      {icon && <Icon icon={icon} size="button" />}
      {children}
    </Link>
  )
}
