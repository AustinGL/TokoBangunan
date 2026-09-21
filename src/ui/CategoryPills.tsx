/**
 * MASTER.md section 8, verbatim:
 * "Horizontal wrap, implemented as a real radio group or tab list. Active:
 * --primary background with --ink-on-primary. Inactive: --surface, 1px
 * --border-input, --ink-muted."
 *
 * Generic over `{ value, label }` options so Stok's kategori filter and
 * Kasir's category pills (a later task) can both reuse this unmodified,
 * rather than coupling it to "kategori" as a concept. Single-select: "a real
 * radio group or tab list" implies one active value at a time. Any implicit
 * "semua"/"all" option is the caller's concern (it is just one more entry in
 * `options`), not something this component knows about.
 *
 * Built on native <input type="radio"> rather than a hand-rolled
 * role="radiogroup", so grouping, arrow-key navigation and Tab-to-enter/exit
 * come from the browser for free instead of being reimplemented.
 */

export type CategoryPillOption = { value: string; label: string }

type Props = {
  name: string
  options: CategoryPillOption[]
  value: string
  onChange: (value: string) => void
  'aria-label'?: string
}

export function CategoryPills({ name, options, value, onChange, ...rest }: Props) {
  return (
    <div role="radiogroup" aria-label={rest['aria-label']} className="flex flex-wrap gap-2">
      {options.map(option => {
        const active = option.value === value
        return (
          <label
            key={option.value}
            className={`min-h-tap inline-flex cursor-pointer items-center rounded-[var(--r-pill)] border px-4 text-[13px] font-medium transition-colors duration-quick has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)] ${
              active
                ? 'border-transparent bg-primary text-ink-on-primary'
                : 'border-border-input bg-surface text-ink-muted'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={active}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}
