import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost'
type Shape = 'pill' | 'field'
type Size = 'md' | 'sm'

const BASE =
  'inline-flex shrink-0 select-none items-center justify-center transition-[color,background-color,transform] duration-quick ease-spring active:scale-[0.92] ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] hover:bg-primary-hover active:bg-primary-active',
  secondary: 'border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-fg)] hover:bg-[rgba(120,120,128,.18)] active:bg-[rgba(120,120,128,.24)]',
  ghost: 'text-ink-muted hover:bg-fill hover:text-ink active:bg-[rgba(120,120,128,.18)]',
}
const SHAPE: Record<Shape, string> = { pill: 'rounded-pill', field: 'rounded-field' }
const SIZE: Record<Size, string> = {
  md: 'h-control w-control',
  sm: "relative h-control-sm w-control-sm before:absolute before:-inset-1 before:content-['']",
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  icon: LucideIcon
  /** Required: an icon-only button has no other accessible name. */
  label: string
  variant?: Variant
  /** `field` matches the radius of a form input sitting next to it. */
  shape?: Shape
  size?: Size
}

export function IconButton({ icon, label, variant = 'secondary', shape = 'pill', size = 'md', type = 'button', className, ...rest }: Props) {
  return (
    <button
      type={type} aria-label={label}
      className={`${BASE} ${VARIANT[variant]} ${SHAPE[shape]} ${SIZE[size]}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      <Icon icon={icon} size="button" />
    </button>
  )
}
