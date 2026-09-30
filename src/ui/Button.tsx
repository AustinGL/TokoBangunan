import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'md' | 'sm'

const BASE =
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-colors duration-quick ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'rounded-pill bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] font-bold',
  secondary: 'rounded-pill border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-fg)] font-semibold',
  ghost: 'rounded-pill text-ink-muted font-medium',
  danger: 'rounded-pill border border-danger bg-danger-bg text-danger font-semibold',
  link: 'rounded-tile text-ink underline font-semibold',
}

// sm is visually 36px but its ::before extends the hit area to 44px.
const SIZE: Record<ButtonSize, string> = {
  md: 'h-control px-4 text-[14px]',
  sm: "h-control-sm px-3 text-[13px] before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
}

// A text link is a hit area, not a box: it keeps a 44px floor instead of a fixed height.
const LINK_SIZE = 'min-h-tap min-w-tap px-1 text-[13px]'

// eslint-disable-next-line react-refresh/only-export-components -- shared class builder for Button, ButtonLink and callers; a plain function never breaks Fast Refresh here
export function buttonClass(variant: ButtonVariant, size: ButtonSize, fullWidth = false): string {
  const sizeClass = variant === 'link' ? LINK_SIZE : SIZE[size]
  return `${BASE} ${VARIANT[variant]} ${sizeClass}${fullWidth ? ' w-full' : ''}`
}

type Shared = { variant?: ButtonVariant; size?: ButtonSize; icon?: LucideIcon; fullWidth?: boolean }

export function Button({
  variant = 'secondary', size = 'md', icon, fullWidth, type = 'button', className, children, ...rest
}: Shared & ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
  return (
    <button type={type} className={`${buttonClass(variant, size, fullWidth)}${className ? ` ${className}` : ''}`} {...rest}>
      {icon && <Icon icon={icon} size="button" />}
      {children}
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
