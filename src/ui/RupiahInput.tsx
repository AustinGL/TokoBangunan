type Props = {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  required?: boolean
  error?: string
}

const formatter = new Intl.NumberFormat('id-ID')

const formatDisplay = (value: number | null): string => (value === null ? '' : formatter.format(value))

export function RupiahInput({ id, label, value, onChange, required, error }: Props) {
  const handleChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '')
    onChange(digitsOnly === '' ? null : Number(digitsOnly))
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[14px] font-medium text-ink">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={formatDisplay(value)}
        onChange={e => handleChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`h-control rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
      />
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}
