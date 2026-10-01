import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { SheetFooter } from '../../ui/SheetFooter'
import { KategoriPicker } from '../shared/KategoriPicker'

export type BarangSheetValues = { nama: string; kategoriId: string | null; diarsipkan: boolean }

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (values: BarangSheetValues) => void | Promise<void>
  initialValues?: { nama: string; kategoriId?: string; diarsipkan: boolean }
  /** Prefills nama for a fresh create only (e.g. a typed search with no catalog match) - ignored once initialValues (an edit) is set. */
  initialNama?: string
}

export function BarangSheet({ open, onClose, onSubmit, initialValues, initialNama }: Props) {
  const [nama, setNama] = useState(initialValues?.nama ?? initialNama ?? '')
  const [kategoriId, setKategoriId] = useState<string | null>(initialValues?.kategoriId ?? null)
  const [diarsipkan, setDiarsipkan] = useState(initialValues?.diarsipkan ?? false)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // A caller that opens this sheet from inside its own <form> (a picker's
    // "+" quick-add, nested at the DOM level even though that's invalid
    // HTML) would otherwise have this submit event bubble up and also
    // trigger the outer form's own onSubmit/validation while its own
    // fields are still empty.
    e.stopPropagation()
    if (nama.trim() === '') {
      setError('Nama barang wajib diisi.')
      return
    }
    setError(null)
    setSubmitError(null)
    setSubmitting(true)
    try {
      await onSubmit({ nama: nama.trim(), kategoriId, diarsipkan })
    } catch {
      // A rejected onSubmit (an IndexedDB write failure, quota exceeded, a
      // legacy virtual barang, and so on) must surface, not vanish - see
      // ItemForm.tsx's own precedent for the same convention.
      setSubmitError('Barang gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={initialValues ? 'Ubah barang' : 'Barang baru'} variant="center">
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-[14px] font-semibold text-danger">
            {submitError}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="barang-nama" className="req text-[14px] font-medium text-ink">Nama barang</label>
          <input
            id="barang-nama" value={nama} onChange={e => setNama(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={`h-control rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <KategoriPicker value={kategoriId} onChange={setKategoriId} />

        {/* Archiving something that does not exist yet makes no sense: edit only. */}
        {initialValues && (
          <label className="flex min-h-control items-center gap-2 text-[14px] text-ink">
            <input type="checkbox" checked={diarsipkan} onChange={e => setDiarsipkan(e.target.checked)} className="h-5 w-5" />
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
