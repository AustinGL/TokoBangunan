import { useState, type FormEvent } from 'react'
import { Sheet } from '../../ui/Sheet'
import { RupiahInput } from '../../ui/RupiahInput'
import { BarangPicker } from '../shared/BarangPicker'
import { UkuranPicker } from '../shared/UkuranPicker'
import { SupplierPicker } from '../shared/SupplierPicker'
import { useKatalog } from '../shared/useKatalog'
import { useToast } from '../../ui/useToast'
import { recordStockPurchase } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { dateAtLocalNoon, todayIsoDate } from '../../domain/tanggal'
import { formatRupiah, rupiah } from '../../domain/money'

type Props = {
  open: boolean
  onClose: () => void
}

const isPositiveInteger = (value: string): boolean => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0
}

export function TambahStokSheet({ open, onClose }: Props) {
  const katalog = useKatalog()
  const { showToast } = useToast()

  const [barangId, setBarangId] = useState<string | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [tanggalBeli, setTanggalBeli] = useState(() => todayIsoDate(systemClock))
  const [jumlah, setJumlah] = useState('')
  const [hargaBeli, setHargaBeli] = useState<number | null>(null)
  const [hargaJual, setHargaJual] = useState<number | null>(null)

  const [barangError, setBarangError] = useState<string | null>(null)
  const [ukuranError, setUkuranError] = useState<string | null>(null)
  const [jumlahError, setJumlahError] = useState<string | null>(null)
  const [hargaJualError, setHargaJualError] = useState<string | null>(null)
  const [tanggalError, setTanggalError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleBarangChange = (newBarangId: string) => {
    setBarangId(newBarangId)
    // A previously chosen ukuran (and the harga jual it prefilled) belongs
    // to the OLD barang - carrying it forward would submit a stock purchase
    // against the wrong barang's ukuran (Review Focus item 1).
    setItemId(null)
    setHargaJual(null)
  }

  const handleUkuranChange = (newItemId: string) => {
    setItemId(newItemId)
    const barang = katalog?.find(r => r.barangId === barangId)
    const ukuran = barang?.ukuran.find(u => u.id === newItemId)
    // A one-time default applied at the moment of selection, not a value
    // that keeps overwriting what the user types afterward (Review Focus
    // item 5) - this handler only runs again on a fresh pick.
    if (ukuran) setHargaJual(ukuran.hargaEceran)
  }

  const totalPembelian = isPositiveInteger(jumlah) && hargaBeli !== null
    ? formatRupiah(rupiah(Number(jumlah) * hargaBeli))
    : null

  const resetForNextEntry = () => {
    setBarangId(null)
    setItemId(null)
    setJumlah('')
    setHargaBeli(null)
    setHargaJual(null)
    // supplierId and tanggalBeli deliberately survive - spec: "Simpan &
    // tambah lagi" keeps the supplier and tanggal for batch entry.
  }

  const submit = async (keepOpen: boolean) => {
    const nextBarangError = barangId === null ? 'Nama barang wajib diisi.' : null
    const nextUkuranError = itemId === null ? 'Ukuran wajib diisi.' : null
    const nextJumlahError = isPositiveInteger(jumlah) ? null : 'Jumlah wajib diisi, bilangan bulat lebih dari 0.'
    const nextHargaJualError = hargaJual === null ? 'Harga jual wajib diisi.' : null
    const nextTanggalError =
      tanggalBeli.trim() === '' ? 'Tanggal beli wajib diisi.'
      : tanggalBeli > todayIsoDate(systemClock) ? 'Tanggal beli tidak boleh di masa depan.'
      : null

    setBarangError(nextBarangError)
    setUkuranError(nextUkuranError)
    setJumlahError(nextJumlahError)
    setHargaJualError(nextHargaJualError)
    setTanggalError(nextTanggalError)
    if (nextBarangError || nextUkuranError || nextJumlahError || nextHargaJualError || nextTanggalError) return

    setSubmitError(null)
    setSubmitting(true)
    try {
      await recordStockPurchase(
        {
          itemId: itemId!,
          qty: Number(jumlah),
          hargaJual: hargaJual!,
          hargaBeli: hargaBeli ?? undefined,
          supplierId: supplierId ?? undefined,
          tanggalBeli: dateAtLocalNoon(tanggalBeli),
        },
        { clock: systemClock, deviceId: getDeviceId() },
      )
      if (keepOpen) {
        resetForNextEntry()
        showToast('Stok ditambahkan.')
      } else {
        onClose()
      }
    } catch {
      // A rejected recordStockPurchase (an IndexedDB write failure, quota
      // exceeded, an ukuran deleted mid-entry) must surface, not vanish -
      // see BarangSheet.tsx's own precedent for the same convention.
      setSubmitError('Stok gagal disimpan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void submit(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Tambah stok">
      <form onSubmit={handleFormSubmit} noValidate className="flex flex-col gap-4">
        {submitError && (
          <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-[14px] font-semibold text-danger">
            {submitError}
          </p>
        )}

        <BarangPicker value={barangId} onChange={handleBarangChange} error={barangError ?? undefined} />
        <UkuranPicker barangId={barangId} value={itemId} onChange={handleUkuranChange} error={ukuranError ?? undefined} />
        <SupplierPicker value={supplierId} onChange={setSupplierId} />

        <div className="flex flex-col gap-1">
          <label htmlFor="tambah-stok-tanggal" className="text-[14px] font-medium text-ink">
            Tanggal beli<span aria-hidden="true"> *</span>
          </label>
          <input
            id="tambah-stok-tanggal" type="date" value={tanggalBeli} max={todayIsoDate(systemClock)}
            onChange={e => setTanggalBeli(e.target.value)}
            aria-invalid={tanggalError ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${tanggalError ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {tanggalError && <p className="text-[13px] text-danger">{tanggalError}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tambah-stok-jumlah" className="text-[14px] font-medium text-ink">
            Jumlah<span aria-hidden="true"> *</span>
          </label>
          <input
            id="tambah-stok-jumlah" type="number" inputMode="numeric" min={1} step={1}
            value={jumlah} onChange={e => setJumlah(e.target.value)}
            aria-invalid={jumlahError ? true : undefined}
            className={`h-[var(--field-h)] rounded-field border bg-[var(--field-bg)] px-3 text-[14px] text-ink ${jumlahError ? 'border-danger' : 'border-[var(--field-bd)]'}`}
          />
          {jumlahError && <p className="text-[13px] text-danger">{jumlahError}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <RupiahInput id="tambah-stok-harga-beli" label="Harga beli" value={hargaBeli} onChange={setHargaBeli} />
          {totalPembelian && <p className="text-[13px] text-ink-muted">Total pembelian {totalPembelian}</p>}
        </div>

        <RupiahInput
          id="tambah-stok-harga-jual" label="Harga jual" required value={hargaJual} onChange={setHargaJual}
          error={hargaJualError ?? undefined}
        />

        <div className="flex items-center justify-between gap-3">
          <button
            type="button" disabled={submitting} onClick={() => void submit(true)}
            className="min-h-tap rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)] disabled:opacity-50"
          >
            Simpan & tambah lagi
          </button>
          <button
            type="submit" disabled={submitting}
            className="min-h-tap rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)] disabled:text-ink-disabled"
          >
            {submitting ? 'Menyimpan...' : 'Simpan stok'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
