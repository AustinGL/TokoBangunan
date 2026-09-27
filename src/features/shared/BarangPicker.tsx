import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Combobox } from '../../ui/Combobox'
import { useKatalog } from './useKatalog'
import { BarangSheet, type BarangSheetValues } from '../kamus/BarangSheet'
import { recordBarang } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'

type Props = {
  value: string | null
  onChange: (barangId: string) => void
  error?: string
}

export function BarangPicker({ value, onChange, error }: Props) {
  const rows = useKatalog()
  const [creating, setCreating] = useState(false)
  const options = (rows ?? []).filter(r => !r.diarsipkan && !r.virtual).map(r => ({ value: r.barangId, label: r.nama }))

  const handleCreate = async (values: BarangSheetValues) => {
    const id = await recordBarang(
      { nama: values.nama, kategori: values.kategori ?? undefined },
      { clock: systemClock, deviceId: getDeviceId() },
    )
    onChange(id)
    setCreating(false)
  }

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Combobox id="tambah-stok-barang" label="Nama barang" options={options} value={value} onChange={onChange} error={error} />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Tambah barang baru"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)]"
        >
          <Plus aria-hidden="true" size={18} />
        </button>
      </div>
      {creating && <BarangSheet open onClose={() => setCreating(false)} onSubmit={handleCreate} />}
    </>
  )
}
