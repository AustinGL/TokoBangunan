import { useRef, useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { SheetFooter } from '../../ui/SheetFooter'

export type KategoriSheetValues = { nama: string; diarsipkan: boolean }

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (values: KategoriSheetValues) => void | Promise<void>
  initialValues?: { nama: string; diarsipkan: boolean }
  /** Prefills a fresh create, for example from text entered in a picker. */
  initialNama?: string
}

export function KategoriSheet({ open, onClose, onSubmit, initialValues, initialNama }: Props) {
  const [nama, setNama] = useState(initialValues?.nama ?? initialNama ?? '')
  const [diarsipkan, setDiarsipkan] = useState(initialValues?.diarsipkan ?? false)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const namaRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // A picker can open this sheet from inside another sheet's form. Keep the
    // submit here instead of triggering that outer form as well.
    event.stopPropagation()
    if (nama.trim() === '') {
      setError('Nama kategori wajib diisi.')
      namaRef.current?.focus()
      return
    }
    setError(null)
    setSubmitError(null)
    setSubmitting(true)
    try {
      await onSubmit({ nama: nama.trim(), diarsipkan })
    } catch (err) {
      setSubmitError(err instanceof Error && err.message === 'Nama kategori sudah dipakai.'
        ? err.message
        : 'Kategori gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={initialValues ? 'Ubah kategori' : 'Kategori baru'} variant="center">
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-[14px] font-semibold text-danger">
            {submitError}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="kategori-nama" className="req text-[14px] font-medium text-ink">Nama kategori</label>
          <input
            ref={namaRef}
            id="kategori-nama"
            value={nama}
            onChange={event => setNama(event.target.value)}
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'kategori-nama-error' : undefined}
            className={`h-control rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {error && <p id="kategori-nama-error" role="alert" className="text-[13px] text-danger">{error}</p>}
        </div>

        {initialValues && (
          <label className="flex min-h-control items-center gap-2 text-[14px] text-ink">
            <input
              type="checkbox"
              checked={diarsipkan}
              onChange={event => setDiarsipkan(event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
            Arsipkan
          </label>
        )}

        <SheetFooter>
          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  )
}
