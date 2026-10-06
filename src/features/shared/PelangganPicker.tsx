import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Combobox } from '../../ui/Combobox'
import { IconButton } from '../../ui/IconButton'
import { useCustomers } from './useCustomers'
import { PelangganSheet, type PelangganSheetValues } from '../pelanggan/PelangganSheet'
import { recordCustomer } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'

type Props = {
  id: string
  value: string | null
  onChange: (customerId: string) => void
  error?: string
}

/**
 * Same shape as SupplierPicker: pick an existing customer, type a new name
 * to quick-add it (nama only), or use + for the full form (telepon, alamat).
 * No Pelanggan master screen exists yet, so a quick-added customer has no
 * later place to be completed: the + form is the way to give a phone number.
 */
export function PelangganPicker({ id, value, onChange, error }: Props) {
  const customers = useCustomers()
  const [quickAddError, setQuickAddError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const options = (customers ?? []).map(c => ({ value: c.id, label: c.nama, hint: c.telepon || undefined }))

  const handleCreate = async (nama: string) => {
    setQuickAddError(null)
    try {
      onChange(await recordCustomer({ nama }, { clock: systemClock, deviceId: getDeviceId() }))
    } catch {
      setQuickAddError('Pelanggan gagal ditambahkan. Coba lagi.')
    }
  }

  // Left to throw: PelangganSheet shows the failure inside its own open dialog.
  const handleFullCreate = async (values: PelangganSheetValues) => {
    const customerId = await recordCustomer(
      { nama: values.nama, telepon: values.telepon ?? undefined, alamat: values.alamat ?? undefined },
      { clock: systemClock, deviceId: getDeviceId() },
    )
    onChange(customerId)
    setCreating(false)
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Combobox id={id} label="Pelanggan" options={options} value={value} onChange={onChange} onCreate={handleCreate} error={error} />
          </div>
          <IconButton icon={Plus} label="Tambah pelanggan baru" shape="field" onClick={() => setCreating(true)} />
        </div>
        {quickAddError && <p role="alert" className="text-sm text-danger">{quickAddError}</p>}
      </div>
      {creating && <PelangganSheet open onClose={() => setCreating(false)} onSubmit={handleFullCreate} />}
    </>
  )
}
