import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { SheetFooter } from '../../ui/SheetFooter'
import { NAMA_TOKO_MAKS } from '../../data/commands'

type Props = {
  open: boolean
  onClose: () => void
  namaAwal: string
  /** The trimmed name; '' clears it. */
  onSubmit: (nama: string) => void | Promise<void>
}

/** The shop's name, used only to introduce the shop in the payment reminder. */
export function NamaTokoSheet({ open, onClose, namaAwal, onSubmit }: Props) {
  const [nama, setNama] = useState(namaAwal)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      await onSubmit(nama.trim())
    } catch {
      setSubmitError('Nama toko gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nama toko">
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger">
            {submitError}
          </p>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="nama-toko" className="text-sm font-medium text-ink">Nama toko</label>
          <input
            id="nama-toko" value={nama} maxLength={NAMA_TOKO_MAKS} onChange={e => setNama(e.target.value)}
            aria-describedby="nama-toko-hint"
            className="h-control rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-base text-ink md:text-sm"
          />
          <p id="nama-toko-hint" className="text-sm text-ink-muted">Kosongkan untuk tidak menyebut nama toko.</p>
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
