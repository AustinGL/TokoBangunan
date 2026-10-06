/**
 * Horizontal wrap, implemented as a real radio group. Active: filled with ink
 * (the one dark accent, keeping blue for actions). Inactive: a quiet gray
 * capsule. The change eases between the two and presses in on tap.
 *
 * Generic over `{ value, label }` options so Stok's kategori filter and
 * Kasir's category pills can both reuse this unmodified, rather than coupling
 * it to "kategori" as a concept. Single-select: a radio group implies one
 * active value at a time. Any implicit "semua"/"all" option is the caller's
 * concern (it is just one more entry in `options`).
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
            className={`min-h-control inline-flex cursor-pointer select-none items-center rounded-pill px-4 text-sm font-medium transition-[background-color,color,transform] duration-quick ease-spring active:scale-[0.96] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)] ${
              active
                ? 'bg-focal text-focal-fg'
                : 'bg-fill text-ink hover:bg-[rgba(120,120,128,.18)]'
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
