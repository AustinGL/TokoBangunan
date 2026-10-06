type Props = {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  required?: boolean
  error?: string
  disabled?: boolean
}

const formatter = new Intl.NumberFormat('id-ID')

const formatDisplay = (value: number | null): string => (value === null ? '' : formatter.format(value))

export function RupiahInput({ id, label, value, onChange, required, error, disabled }: Props) {
  const handleChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '')
    onChange(digitsOnly === '' ? null : Number(digitsOnly))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={`text-sm font-medium text-ink ${required ? 'req' : ''}`}>
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={formatDisplay(value)}
        onChange={e => handleChange(e.target.value)}
        aria-required={required ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={disabled}
        className={`h-control rounded-field border bg-[var(--field-bg)] px-3.5 text-base tabular-nums text-ink md:text-sm disabled:cursor-not-allowed disabled:bg-surface-card disabled:text-ink-disabled ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
      />
      {error && <p id={`${id}-error`} className="text-sm text-danger">{error}</p>}
    </div>
  )
}
