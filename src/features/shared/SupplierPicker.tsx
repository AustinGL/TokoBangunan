import { useState } from 'react'
import { Combobox } from '../../ui/Combobox'
import { useToast } from '../../ui/useToast'
import { useSuppliers } from './useSuppliers'
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

  return (
    <div className="flex flex-col gap-1">
      <Combobox
        id="tambah-stok-supplier" label="Supplier" options={options} value={value}
        onChange={onChange} onCreate={handleCreate} error={error}
      />
      {quickAddError && <p role="alert" className="text-[13px] text-danger">{quickAddError}</p>}
    </div>
  )
}
