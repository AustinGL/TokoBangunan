import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'

export type BarangSheetValues = { nama: string; kategori: string | null; diarsipkan: boolean }

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (values: BarangSheetValues) => void | Promise<void>
  /** Read-model shape (string | undefined), distinct from the onSubmit payload - see this file's own plan task. */
  initialValues?: { nama: string; kategori?: string; diarsipkan: boolean }
}

export function BarangSheet({ open, onClose, onSubmit, initialValues }: Props) {
  const [nama, setNama] = useState(initialValues?.nama ?? '')
  const [kategori, setKategori] = useState(initialValues?.kategori ?? '')
  const [diarsipkan, setDiarsipkan] = useState(initialValues?.diarsipkan ?? false)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (nama.trim() === '') {
      setError('Nama barang wajib diisi.')
      return
    }
    setError(null)
    setSubmitError(null)
    setSubmitting(true)
    try {
      await onSubmit({ nama: nama.trim(), kategori: kategori.trim() === '' ? null : kategori.trim(), diarsipkan })
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
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-[14px] font-semibold text-danger">
            {submitError}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="barang-nama" className="text-[14px] font-medium text-ink">Nama barang</label>
          <input
            id="barang-nama" value={nama} onChange={e => setNama(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="barang-kategori" className="text-[14px] font-medium text-ink">Kategori</label>
          <input
            id="barang-kategori" value={kategori} onChange={e => setKategori(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
          />
        </div>

        <label className="flex min-h-tap items-center gap-2 text-[14px] text-ink">
          <input type="checkbox" checked={diarsipkan} onChange={e => setDiarsipkan(e.target.checked)} className="h-5 w-5" />
          Arsipkan
        </label>

        <button
          type="submit" disabled={submitting}
          className="min-h-tap rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:text-ink-disabled"
        >
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>
    </Sheet>
  )
}
