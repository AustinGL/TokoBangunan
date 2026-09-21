import { useEffect, useRef, useState, type FormEvent } from 'react'

export type ItemFormValues = {
  nama: string
  baseUnit: string
  hargaEceran: number
  stokMinimum: number
  barcode?: string
  kategori?: string
  /** Whole units of baseUnit. Omitted (not 0) when the field was left blank. */
  stokAwal?: number
}

type Props = {
  /**
   * Receives the validated values. The caller (not ItemForm) is responsible
   * for building a CommandContext and calling commands.recordItem, so this
   * component stays a pure presentation/validation piece, testable without a
   * real Dexie instance.
   */
  onSubmit: (values: ItemFormValues) => void
}

type FieldKey = 'nama' | 'baseUnit' | 'hargaEceran' | 'stokMinimum' | 'stokAwal'
type FieldErrors = Partial<Record<FieldKey, string>>

const FIELD_LABELS: Record<FieldKey, string> = {
  nama: 'Nama barang',
  baseUnit: 'Satuan dasar',
  hargaEceran: 'Harga eceran',
  stokMinimum: 'Stok minimum',
  stokAwal: 'Stok awal',
}

const isNonNegativeInteger = (value: string): boolean => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0
}

type FieldProps = {
  id: FieldKey | 'barcode' | 'kategori'
  label: string
  type?: 'text' | 'number'
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
}

function FormField({ id, label, type = 'text', value, onChange, required, error }: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[14px] font-medium text-ink">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={type === 'number' ? 'numeric' : undefined}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 1 : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink placeholder:text-[var(--field-placeholder)] ${
          error ? 'border-danger' : 'border-[var(--field-bd)]'
        }`}
      />
      {error && (
        <p id={errorId} className="text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function ItemForm({ onSubmit }: Props) {
  const [nama, setNama] = useState('')
  const [baseUnit, setBaseUnit] = useState('')
  const [hargaEceran, setHargaEceran] = useState('')
  const [stokMinimum, setStokMinimum] = useState('')
  const [stokAwal, setStokAwal] = useState('')
  const [barcode, setBarcode] = useState('')
  const [kategori, setKategori] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const summaryRef = useRef<HTMLDivElement>(null)

  const errorList = Object.entries(errors) as Array<[FieldKey, string]>

  useEffect(() => {
    // A failed submit with more than one error moves focus to the summary.
    // Never on blur, only as a direct result of the submit that produced it.
    if (errorList.length > 1) summaryRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors])

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const nextErrors: FieldErrors = {}
    if (nama.trim() === '') nextErrors.nama = 'Nama barang wajib diisi.'
    if (baseUnit.trim() === '') nextErrors.baseUnit = 'Satuan dasar wajib diisi.'

    if (hargaEceran.trim() === '') {
      nextErrors.hargaEceran = 'Harga eceran wajib diisi.'
    } else if (!isNonNegativeInteger(hargaEceran)) {
      nextErrors.hargaEceran = 'Harga eceran harus bilangan bulat, minimal 0.'
    }

    if (stokMinimum.trim() === '') {
      nextErrors.stokMinimum = 'Stok minimum wajib diisi.'
    } else if (!isNonNegativeInteger(stokMinimum)) {
      nextErrors.stokMinimum = 'Stok minimum harus bilangan bulat, minimal 0.'
    }

    if (stokAwal.trim() !== '' && !isNonNegativeInteger(stokAwal)) {
      nextErrors.stokAwal = 'Stok awal harus bilangan bulat, minimal 0.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSubmit({
      nama: nama.trim(),
      baseUnit: baseUnit.trim(),
      hargaEceran: Number(hargaEceran),
      stokMinimum: Number(stokMinimum),
      stokAwal: stokAwal.trim() === '' ? undefined : Number(stokAwal),
      barcode: barcode.trim() === '' ? undefined : barcode.trim(),
      kategori: kategori.trim() === '' ? undefined : kategori.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-md flex-col gap-4">
      {errorList.length > 1 && (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-field border border-danger bg-danger-bg p-4 text-[14px] text-danger focus-visible:outline-none"
        >
          <p className="font-semibold">Periksa kembali isian berikut:</p>
          <ul className="mt-2 list-disc pl-5">
            {errorList.map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`} className="underline">
                  {FIELD_LABELS[field]}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormField id="nama" label="Nama barang" value={nama} onChange={setNama} required error={errors.nama} />
      <FormField id="baseUnit" label="Satuan dasar" value={baseUnit} onChange={setBaseUnit} required error={errors.baseUnit} />
      <FormField id="hargaEceran" label="Harga eceran" type="number" value={hargaEceran} onChange={setHargaEceran} required error={errors.hargaEceran} />
      <FormField id="stokMinimum" label="Stok minimum" type="number" value={stokMinimum} onChange={setStokMinimum} required error={errors.stokMinimum} />
      <FormField id="stokAwal" label="Stok awal" type="number" value={stokAwal} onChange={setStokAwal} error={errors.stokAwal} />
      <FormField id="barcode" label="Barcode" value={barcode} onChange={setBarcode} />
      <FormField id="kategori" label="Kategori" value={kategori} onChange={setKategori} />

      <button
        type="submit"
        className="min-h-tap rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-primary-fg)]"
      >
        Simpan barang
      </button>
    </form>
  )
}
