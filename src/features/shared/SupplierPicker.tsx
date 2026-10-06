import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Combobox } from '../../ui/Combobox'
import { IconButton } from '../../ui/IconButton'
import { useToast } from '../../ui/useToast'
import { useSuppliers } from './useSuppliers'
import { SupplierSheet, type SupplierSheetValues } from '../supplier/SupplierSheet'
import { recordSupplier } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'

type Props = {
  value: string | null
  onChange: (supplierId: string) => void
  error?: string
}

export function SupplierPicker({ value, onChange, error }: Props) {
  const suppliers = useSuppliers()
  const { showToast } = useToast()
  const [quickAddError, setQuickAddError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const options = (suppliers ?? []).map(s => ({ value: s.id, label: s.nama, hint: s.telepon || undefined }))

  const handleCreate = async (nama: string) => {
    setQuickAddError(null)
    try {
      const id = await recordSupplier({ nama, quickAdd: true }, { clock: systemClock, deviceId: getDeviceId() })
      onChange(id)
      showToast('Supplier ditambahkan. Lengkapi datanya nanti di menu Supplier.')
    } catch {
      // A rejected recordSupplier (an IndexedDB write failure, quota
      // exceeded) must surface, not vanish silently - see BarangSheet.tsx's
      // own precedent for the same convention, required by this plan's
      // Global Constraints.
      setQuickAddError('Supplier gagal ditambahkan. Coba lagi.')
    }
  }

  // A full-form supplier is complete, so it is NOT flagged perluDilengkapi
  // (that flag is only for the type-a-name shortcut above). Left to throw:
  // SupplierSheet shows the failure inside its own open dialog.
  const handleFullCreate = async (values: SupplierSheetValues) => {
    const id = await recordSupplier({
      nama: values.nama,
      telepon: values.telepon ?? undefined,
      alamat: values.alamat ?? undefined,
      kontak: values.kontak ?? undefined,
      catatan: values.catatan ?? undefined,
    }, { clock: systemClock, deviceId: getDeviceId() })
    onChange(id)
    setCreating(false)
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Combobox
              id="tambah-stok-supplier" label="Supplier" options={options} value={value}
              onChange={onChange} onCreate={handleCreate} error={error}
            />
          </div>
          <IconButton icon={Plus} label="Tambah supplier baru" shape="field" onClick={() => setCreating(true)} />
        </div>
        {quickAddError && <p role="alert" className="text-sm text-danger">{quickAddError}</p>}
      </div>
      {creating && (
        <SupplierSheet open onClose={() => setCreating(false)} onSubmit={handleFullCreate} />
      )}
    </>
  )
}
