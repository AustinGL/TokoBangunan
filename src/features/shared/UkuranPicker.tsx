import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Combobox } from '../../ui/Combobox'
import { useKatalog } from './useKatalog'
import { UkuranSheet, type UkuranSheetValues } from '../kamus/UkuranSheet'
import { recordUkuran } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'

type Props = {
  barangId: string | null
  value: string | null
  onChange: (itemId: string) => void
  error?: string
}

export function UkuranPicker({ barangId, value, onChange, error }: Props) {
  const rows = useKatalog()
  const [creating, setCreating] = useState(false)
  const barang = rows?.find(r => r.barangId === barangId)
  const options = (barang?.ukuran ?? []).filter(u => !u.diarsipkan).map(u => ({ value: u.id, label: u.ukuran }))

  const handleCreate = async (values: UkuranSheetValues) => {
    if (!barangId) return
    const id = await recordUkuran(
      { barangId, ukuran: values.ukuran, hargaEceran: values.hargaEceran, stokMinimum: values.stokMinimum, barcode: values.barcode ?? undefined },
      { clock: systemClock, deviceId: getDeviceId() },
    )
    onChange(id)
    setCreating(false)
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
      {creating && barangId && (
        <UkuranSheet
          open onClose={() => setCreating(false)} onSubmit={handleCreate}
          barangOptions={[{ barangId, nama: barang?.nama ?? '' }]} currentBarangId={barangId}
        />
      )}
    </>
  )
}
