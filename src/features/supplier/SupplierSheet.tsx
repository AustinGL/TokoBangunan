import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { formatTanggal } from '../shared/formatTanggal'

export type SupplierSheetValues = { nama: string; telepon: string | null; alamat: string | null; kontak: string | null; catatan: string | null }

export type RiwayatBatch = { batchId: string; tanggalBeli: string; itemId: string }

/**
 * initialValues intentionally has a different shape than the onSubmit
 * payload: it mirrors Supplier's own read-model shape (string | undefined,
 * "no value stored"), while onSubmit's SupplierSheetValues uses string |
 * null ("explicitly cleared") - see this file's own plan task for why they
 * cannot be the same type.
 */
type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (values: SupplierSheetValues) => void | Promise<void>
  initialValues?: { nama: string; telepon?: string; alamat?: string; kontak?: string; catatan?: string }
  riwayat?: RiwayatBatch[]
}

const trimOrNull = (v: string): string | null => (v.trim() === '' ? null : v.trim())

export function SupplierSheet({ open, onClose, onSubmit, initialValues, riwayat }: Props) {
  const [nama, setNama] = useState(initialValues?.nama ?? '')
  const [telepon, setTelepon] = useState(initialValues?.telepon ?? '')
  const [alamat, setAlamat] = useState(initialValues?.alamat ?? '')
  const [kontak, setKontak] = useState(initialValues?.kontak ?? '')
  const [catatan, setCatatan] = useState(initialValues?.catatan ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (nama.trim() === '') {
      setError('Nama supplier wajib diisi.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        nama: nama.trim(),
        telepon: trimOrNull(telepon),
        alamat: trimOrNull(alamat),
        kontak: trimOrNull(kontak),
        catatan: trimOrNull(catatan),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={initialValues ? 'Ubah supplier' : 'Supplier baru'}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="supplier-nama" className="text-[14px] font-medium text-ink">Nama</label>
          <input
            id="supplier-nama" value={nama} onChange={e => setNama(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${error ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="supplier-telepon" className="text-[14px] font-medium text-ink">Telepon</label>
          <input id="supplier-telepon" value={telepon} onChange={e => setTelepon(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="supplier-alamat" className="text-[14px] font-medium text-ink">Alamat</label>
          <input id="supplier-alamat" value={alamat} onChange={e => setAlamat(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="supplier-kontak" className="text-[14px] font-medium text-ink">Kontak</label>
          <input id="supplier-kontak" value={kontak} onChange={e => setKontak(e.target.value)}
            className="h-[var(--field-h)] rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="supplier-catatan" className="text-[14px] font-medium text-ink">Catatan</label>
          <textarea id="supplier-catatan" value={catatan} onChange={e => setCatatan(e.target.value)} rows={3}
            className="rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] p-3 text-[14px] text-ink" />
        </div>

        <button
          type="submit" disabled={submitting}
          className="min-h-tap rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:text-ink-disabled"
        >
          {submitting ? 'Menyimpan...' : 'Simpan'}
        </button>

        {riwayat && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-[13px] font-semibold text-ink">Riwayat pembelian</h3>
            {riwayat.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Belum ada pembelian.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {riwayat.map(r => (
                  <li key={r.batchId} className="text-[13px] text-ink-muted">
                    {formatTanggal(r.tanggalBeli)} · {r.itemId}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </Sheet>
  )
}
