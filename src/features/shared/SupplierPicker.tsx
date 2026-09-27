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
  const options = (suppliers ?? []).map(s => ({ value: s.id, label: s.nama }))

  const handleCreate = async (nama: string) => {
    const id = await recordSupplier({ nama, quickAdd: true }, { clock: systemClock, deviceId: getDeviceId() })
    onChange(id)
    showToast('Supplier ditambahkan. Lengkapi datanya nanti di menu Supplier.')
  }

  return (
    <Combobox
      id="tambah-stok-supplier" label="Supplier" options={options} value={value}
      onChange={onChange} onCreate={handleCreate} error={error}
    />
  )
}
