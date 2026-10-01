import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Combobox } from '../../ui/Combobox'
import { IconButton } from '../../ui/IconButton'
import { useKategori } from './useKategori'
import { KategoriSheet, type KategoriSheetValues } from '../kategori/KategoriSheet'
import { recordKategori } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'

const NONE = '__tanpa-kategori__'

type Props = {
  value: string | null
  onChange: (kategoriId: string | null) => void
}

export function KategoriPicker({ value, onChange }: Props) {
  const entries = useKategori()
  const [creating, setCreating] = useState(false)
  const [quickAddError, setQuickAddError] = useState<string | null>(null)

  // Archived kategori are hidden from new choices. A currently selected one
  // stays available so editing an existing barang never blanks a real value.
  const options = [
    { value: NONE, label: 'Tanpa kategori' },
    ...(entries ?? [])
      .filter(entry => !entry.diarsipkan || entry.id === value)
      .map(entry => ({ value: entry.id, label: entry.nama })),
  ]

  const ctx = () => ({ clock: systemClock, deviceId: getDeviceId() })

  const handleCreateTyped = async (nama: string) => {
    setQuickAddError(null)
    try {
      onChange(await recordKategori({ nama }, ctx()))
    } catch {
      setQuickAddError('Kategori gagal ditambahkan. Coba lagi.')
    }
  }

  const handleSheetSubmit = async (values: KategoriSheetValues) => {
    onChange(await recordKategori({ nama: values.nama }, ctx()))
    setCreating(false)
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Combobox
              id="barang-kategori"
              label="Kategori"
              options={options}
              value={value}
              onChange={next => onChange(next === NONE ? null : next)}
              onCreate={handleCreateTyped}
            />
          </div>
          <IconButton icon={Plus} label="Tambah kategori baru" shape="field" onClick={() => setCreating(true)} />
        </div>
        {quickAddError && <p role="alert" className="text-[13px] text-danger">{quickAddError}</p>}
      </div>
      {creating && <KategoriSheet open onClose={() => setCreating(false)} onSubmit={handleSheetSubmit} />}
    </>
  )
}
