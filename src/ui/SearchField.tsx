import { Search } from 'lucide-react'

type Props = {
  id: string
  /** Kept for assistive tech; not drawn (the magnifier and placeholder say it). */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/** Pill search input (docs/REDESIGN.md section 7). */
export function SearchField({ id, label, value, onChange, placeholder }: Props) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search
        aria-hidden="true"
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
      />
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[var(--field-h)] w-full rounded-pill border border-[var(--field-bd)] bg-[var(--field-bg)] pl-11 pr-4 text-[14px] text-ink placeholder:text-[var(--field-placeholder)]"
      />
    </div>
  )
}
