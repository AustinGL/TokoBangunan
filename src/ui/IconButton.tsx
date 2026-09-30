import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost'
type Shape = 'pill' | 'field'
type Size = 'md' | 'sm'

const BASE =
  'relative inline-flex shrink-0 items-center justify-center transition-colors duration-quick ' +
  'disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]',
  secondary: 'border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-fg)]',
  ghost: 'text-ink-muted',
}
const SHAPE: Record<Shape, string> = { pill: 'rounded-pill', field: 'rounded-field' }
const SIZE: Record<Size, string> = {
  md: 'h-control w-control',
  sm: "h-control-sm w-control-sm before:absolute before:-inset-1 before:content-['']",
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
