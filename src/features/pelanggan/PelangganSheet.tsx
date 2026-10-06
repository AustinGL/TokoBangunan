import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { SheetFooter } from '../../ui/SheetFooter'

export type PelangganSheetValues = { nama: string; telepon: string | null; alamat: string | null }

/**
 * initialValues mirrors the stored customer (string | undefined, "no value");
 * onSubmit's values use null for "cleared", so a blank field can erase one.
 */
type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (values: PelangganSheetValues) => void | Promise<void>
  /** Given: the sheet edits that customer ("Ubah pelanggan") instead of creating one. */
  initialValues?: { nama: string; telepon?: string; alamat?: string }
  /** A line of explanation shown above the fields. */
  hint?: string
}

const trimOrNull = (v: string): string | null => (v.trim() === '' ? null : v.trim())

const FIELD = 'h-control rounded-field border bg-[var(--field-bg)] px-3 text-base text-ink md:text-sm'

export function PelangganSheet({ open, onClose, onSubmit, initialValues, hint }: Props) {
  const [nama, setNama] = useState(initialValues?.nama ?? '')
  const [telepon, setTelepon] = useState(initialValues?.telepon ?? '')
  const [alamat, setAlamat] = useState(initialValues?.alamat ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (nama.trim() === '') {
      setError('Nama pelanggan wajib diisi.')
      return
    }
    setError(null)
    setSubmitError(null)
    setSubmitting(true)
    try {
      await onSubmit({ nama: nama.trim(), telepon: trimOrNull(telepon), alamat: trimOrNull(alamat) })
    } catch {
      setSubmitError('Pelanggan gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={initialValues ? 'Ubah pelanggan' : 'Pelanggan baru'}>
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger">
            {submitError}
          </p>
        )}
        {hint && <p className="text-sm text-ink-muted">{hint}</p>}
        <div className="flex flex-col gap-1">
          <label htmlFor="pelanggan-nama" className="req text-sm font-medium text-ink">Nama</label>
          <input
            id="pelanggan-nama" value={nama} onChange={e => setNama(e.target.value)}
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'pelanggan-nama-error' : undefined}
            className={`${FIELD} ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {error && <p id="pelanggan-nama-error" className="text-sm text-danger">{error}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pelanggan-telepon" className="text-sm font-medium text-ink">Telepon</label>
          <input id="pelanggan-telepon" inputMode="tel" value={telepon} onChange={e => setTelepon(e.target.value)} className={`${FIELD} border-[var(--field-bd)]`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pelanggan-alamat" className="text-sm font-medium text-ink">Alamat</label>
          <input id="pelanggan-alamat" value={alamat} onChange={e => setAlamat(e.target.value)} className={`${FIELD} border-[var(--field-bd)]`} />
        </div>
        <SheetFooter>
          <Button type="submit" variant="primary" fullWidth loading={submitting} loadingLabel="Menyimpan...">
            Simpan
          </Button>
        </SheetFooter>
      </form>
    </Sheet>
  )
}
