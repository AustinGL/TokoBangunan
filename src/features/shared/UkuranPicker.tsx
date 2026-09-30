import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Combobox } from '../../ui/Combobox'
import { Sheet } from '../../ui/Sheet'
import { Button } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { useKatalog } from './useKatalog'
import { UkuranSheet, type UkuranSheetValues } from '../kamus/UkuranSheet'
import { recordUkuran } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { findNearDuplicate } from '../../domain/katalog'
import { formatRupiah, rupiah } from '../../domain/money'

type Props = {
  barangId: string | null
  value: string | null
  onChange: (itemId: string, meta?: { hargaEceran: number }) => void
  error?: string
  /** Marks the field required (a visible *). */
  required?: boolean
}

type PendingDuplicate = { values: UkuranSheetValues; existingLabel: string; existingValue: string }

export function UkuranPicker({ barangId, value, onChange, error, required }: Props) {
  const rows = useKatalog()
  const [creating, setCreating] = useState(false)
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const barang = rows?.find(r => r.barangId === barangId)
  const options = (barang?.ukuran ?? []).filter(u => !u.diarsipkan).map(u => ({
    value: u.id,
    label: u.ukuran,
    hint: `Stok ${u.quantity} · ${formatRupiah(rupiah(u.hargaEceran))}`,
  }))

  // Writes the ukuran and reports success to the caller - throws on
  // failure rather than swallowing it, so each caller below decides how to
  // surface that failure in its own context (UkuranSheet's own dialog for
  // the normal create flow; the near-duplicate confirm sheet for "Tetap
  // buat baru").
  const createUkuran = async (values: UkuranSheetValues) => {
    if (!barangId) return
    const id = await recordUkuran(
      { barangId, ukuran: values.ukuran, hargaEceran: values.hargaEceran, stokMinimum: values.stokMinimum, barcode: values.barcode ?? undefined },
      { clock: systemClock, deviceId: getDeviceId() },
    )
    // Passes the just-typed price along explicitly: useKatalog's own live
    // query has not necessarily re-fetched by the time this resolves, so a
    // caller that looked the new id up in its own (possibly stale) katalog
    // data would find nothing there yet.
    onChange(id, { hargaEceran: values.hargaEceran })
    setCreating(false)
    setPendingDuplicate(null)
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
    // Left to throw on failure: UkuranSheet's own onSubmit try/catch turns
    // a rejection into a visible error inside its own (still open) dialog,
    // the same way it already does for every other caller of UkuranSheet -
    // a sibling error rendered by this component instead would sit behind
    // that open <dialog>'s own top layer, invisible to the user.
    await createUkuran(values)
  }

  const handleTetapBuatBaru = async () => {
    if (!pendingDuplicate) return
    setCreateError(null)
    try {
      await createUkuran(pendingDuplicate.values)
    } catch {
      // No form here to catch this itself (unlike handleCreate's own
      // UkuranSheet) - required by this plan's Global Constraints.
      setCreateError('Ukuran gagal disimpan. Coba lagi.')
    }
  }

  return (
    <>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Combobox
            id="tambah-stok-ukuran" label="Ukuran" options={options} value={value} onChange={onChange}
            error={error} disabled={!barangId} required={required}
          />
        </div>
        <IconButton icon={Plus} label="Tambah ukuran baru" shape="field" disabled={!barangId} onClick={() => setCreating(true)} />
      </div>
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
              <Button variant="primary" onClick={() => { onChange(pendingDuplicate.existingValue); setPendingDuplicate(null) }}>
                Pakai yang ada
              </Button>
              <Button variant="secondary" onClick={handleTetapBuatBaru}>
                Tetap buat baru
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
