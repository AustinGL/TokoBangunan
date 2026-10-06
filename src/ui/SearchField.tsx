import { Search } from 'lucide-react'
import { Icon } from './Icon'

type Props = {
  id: string
  /** Kept for assistive tech; not drawn (the magnifier and placeholder say it). */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

/** Compact search input used by dense operational lists. */
export function SearchField({ id, label, value, onChange, placeholder, disabled }: Props) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Icon icon={Search} size="button" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-control w-full rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] pl-10 pr-4 text-base text-ink md:text-sm placeholder:text-[var(--field-placeholder)] disabled:cursor-not-allowed disabled:bg-surface-card disabled:text-ink-disabled"
      />
    </div>
  )
}
