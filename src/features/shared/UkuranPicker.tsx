import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Combobox } from '../../ui/Combobox'
import { Sheet } from '../../ui/Sheet'
import { useKatalog } from './useKatalog'
import { UkuranSheet, type UkuranSheetValues } from '../kamus/UkuranSheet'
import { recordUkuran } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { findNearDuplicate } from '../../domain/katalog'

type Props = {
  barangId: string | null
  value: string | null
  onChange: (itemId: string) => void
  error?: string
}

type PendingDuplicate = { values: UkuranSheetValues; existingLabel: string; existingValue: string }

export function UkuranPicker({ barangId, value, onChange, error }: Props) {
  const rows = useKatalog()
  const [creating, setCreating] = useState(false)
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const barang = rows?.find(r => r.barangId === barangId)
  const options = (barang?.ukuran ?? []).filter(u => !u.diarsipkan).map(u => ({ value: u.id, label: u.ukuran }))

  const createUkuran = async (values: UkuranSheetValues) => {
    if (!barangId) return
    setCreateError(null)
    try {
      const id = await recordUkuran(
        { barangId, ukuran: values.ukuran, hargaEceran: values.hargaEceran, stokMinimum: values.stokMinimum, barcode: values.barcode ?? undefined },
        { clock: systemClock, deviceId: getDeviceId() },
      )
      onChange(id)
      setCreating(false)
      setPendingDuplicate(null)
    } catch {
      // A rejected recordUkuran (an IndexedDB write failure, quota
      // exceeded) must surface, not vanish silently - see BarangSheet.tsx's
      // own precedent for the same convention, required by this plan's
      // Global Constraints.
      setCreateError('Ukuran gagal disimpan. Coba lagi.')
    }
  }

  const handleCreate = async (values: UkuranSheetValues) => {
    const dup = findNearDuplicate(values.ukuran, options.map(o => o.label))
    if (dup) {
      const existingOption = options.find(o => o.label === dup)
      if (existingOption) {
        setPendingDuplicate({ values, existingLabel: dup, existingValue: existingOption.value })
        setCreating(false)
        return
      }
    }
    await createUkuran(values)
  }

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Combobox
            id="tambah-stok-ukuran" label="Ukuran" options={options} value={value} onChange={onChange}
            error={error} disabled={!barangId}
          />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!barangId}
          aria-label="Tambah ukuran baru"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] disabled:opacity-50"
        >
          <Plus aria-hidden="true" size={18} />
        </button>
      </div>
      {createError && <p role="alert" className="mt-1 text-[13px] text-danger">{createError}</p>}
      {creating && barangId && (
        <UkuranSheet
          open onClose={() => setCreating(false)} onSubmit={handleCreate}
          barangOptions={[{ barangId, nama: barang?.nama ?? '' }]} currentBarangId={barangId}
        />
      )}
      {pendingDuplicate && (
        <Sheet open onClose={() => setPendingDuplicate(null)} title="Ukuran mirip ditemukan" variant="center">
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-ink">
              Ukuran &quot;{pendingDuplicate.values.ukuran}&quot; mirip dengan &quot;{pendingDuplicate.existingLabel}&quot; yang sudah ada.
            </p>
            {createError && <p role="alert" className="text-[13px] text-danger">{createError}</p>}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { onChange(pendingDuplicate.existingValue); setPendingDuplicate(null) }}
                className="min-h-tap rounded-field bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
              >
                Pakai yang ada
              </button>
              <button
                type="button"
                onClick={() => createUkuran(pendingDuplicate.values)}
                className="min-h-tap rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)]"
              >
                Tetap buat baru
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
