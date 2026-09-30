import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Combobox } from '../../ui/Combobox'
import { IconButton } from '../../ui/IconButton'
import { useKatalog } from './useKatalog'
import { BarangSheet, type BarangSheetValues } from '../kamus/BarangSheet'
import { recordBarang } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'

type Props = {
  value: string | null
  onChange: (barangId: string) => void
  error?: string
  /** Marks the field required (a visible *). */
  required?: boolean
  /** Forwarded to BarangSheet's own initialNama on a fresh quick-add. */
  initialNama?: string
}

export function BarangPicker({ value, onChange, error, required, initialNama }: Props) {
  const rows = useKatalog()
  const [creating, setCreating] = useState(false)
  const options = (rows ?? []).filter(r => !r.diarsipkan && !r.virtual).map(r => ({ value: r.barangId, label: r.nama, hint: r.kategori || undefined }))

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
          <Combobox id="tambah-stok-barang" label="Nama barang" options={options} value={value} onChange={onChange} error={error} required={required} />
        </div>
        <IconButton icon={Plus} label="Tambah barang baru" shape="field" onClick={() => setCreating(true)} />
      </div>
      {creating && <BarangSheet open onClose={() => setCreating(false)} onSubmit={handleCreate} initialNama={initialNama} />}
    </>
  )
}
