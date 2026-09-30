import { useMemo, useState } from 'react'
import { useSuppliers } from '../shared/useSuppliers'
import { SupplierSheet, type SupplierSheetValues, type RiwayatBatch } from './SupplierSheet'
import { recordSupplier, updateSupplier } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { db } from '../../data/db'
import { StatusPill } from '../../ui/StatusPill'
import { AlertTriangle, Truck } from 'lucide-react'
import { PageHeader } from '../../ui/PageHeader'
import { IconTile } from '../../ui/IconTile'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import type { Supplier as SupplierRow } from '../../domain/projections/suppliers'

function ctx() {
  return { clock: systemClock, deviceId: getDeviceId() }
}

export function Supplier() {
  const suppliers = useSuppliers()
  const [reviewOnly, setReviewOnly] = useState(false)
  const [sheet, setSheet] = useState<{ mode: 'create' } | { mode: 'edit'; row: SupplierRow } | null>(null)
  const [riwayat, setRiwayat] = useState<RiwayatBatch[] | undefined>(undefined)

  const perluDilengkapiCount = useMemo(() => (suppliers ?? []).filter(s => s.perluDilengkapi).length, [suppliers])
  // Derived, not stored directly: once nothing is left to review (the last
  // flagged supplier just got saved), the filter falls back to the full
  // list on its own, rather than leaving reviewOnly stuck true against an
  // empty result with no visible way back.
  const reviewFilterActive = reviewOnly && perluDilengkapiCount > 0
  const visible = useMemo(() => {
    if (!suppliers) return []
    return reviewFilterActive ? suppliers.filter(s => s.perluDilengkapi) : suppliers
  }, [suppliers, reviewFilterActive])

  const openEdit = async (row: SupplierRow) => {
    const batches = await db.batchesProj.where('supplierId').equals(row.id).toArray()
    // batchesProj carries only itemId, not a display name - join itemsProj
    // here (SupplierSheet has no Dexie access of its own) so riwayat shows
    // what was actually bought, not a raw id. Sorted newest-first: a Dexie
    // secondary-index query makes no ordering guarantee of its own.
    const itemIds = [...new Set(batches.map(b => b.itemId))]
    const items = await db.itemsProj.bulkGet(itemIds)
    const itemById = new Map(itemIds.map((id, i) => [id, items[i]]))
    const sorted = [...batches].sort((a, b) => (a.tanggalBeli < b.tanggalBeli ? 1 : -1))
    setRiwayat(sorted.map(b => {
      const item = itemById.get(b.itemId)
      return {
        batchId: b.batchId,
        tanggalBeli: b.tanggalBeli,
        nama: item ? `${item.nama} · ${item.baseUnit}` : 'Ukuran tidak ditemukan',
      }
    }))
    setSheet({ mode: 'edit', row })
  }

  const handleSubmit = async (values: SupplierSheetValues) => {
    if (sheet?.mode === 'edit') {
      // updateSupplier's own null-means-clear convention: pass values straight through.
      await updateSupplier({ id: sheet.row.id, ...values }, ctx())
    } else {
      // recordSupplier has no existing row to preserve, so a blank field is
      // simply "not provided" - null and undefined mean the same thing here.
      await recordSupplier({
        nama: values.nama,
        telepon: values.telepon ?? undefined,
        alamat: values.alamat ?? undefined,
        kontak: values.kontak ?? undefined,
        catatan: values.catatan ?? undefined,
      }, ctx())
    }
    setSheet(null)
    setRiwayat(undefined)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <PageHeader
        title="Supplier"
        subtitle={suppliers !== undefined ? `${suppliers.length} supplier` : undefined}
        action={
          <button
            type="button"
            onClick={() => setSheet({ mode: 'create' })}
            className="min-h-tap rounded-pill bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
          >
            + Supplier baru
          </button>
        }
      />

      {perluDilengkapiCount > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-card border border-warning bg-warning-bg p-4">
          <p className="flex items-center gap-3 text-[14px] font-medium text-warning">
            <AlertTriangle aria-hidden="true" size={20} className="shrink-0" />
            <span>{perluDilengkapiCount} supplier baru perlu dilengkapi</span>
          </p>
          <button
            type="button"
            aria-pressed={reviewFilterActive}
            onClick={() => setReviewOnly(on => !on)}
            className="min-h-tap shrink-0 rounded-pill bg-surface px-4 text-[13px] font-semibold text-warning"
          >
            {reviewFilterActive ? 'Tampilkan semua' : 'Tinjau'}
          </button>
        </div>
      )}

      {suppliers === undefined ? (
        <ListSkeleton label="Memuat daftar supplier..." />
      ) : suppliers.length === 0 ? (
        <EmptyState icon={Truck}>Belum ada supplier. Mulai tambahkan supplier.</EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map(row => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="flex min-h-tap w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-card transition-colors duration-instant hover:bg-[var(--table-row-hover)]"
              >
                <IconTile icon={Truck} tone={row.perluDilengkapi ? 'warning' : 'neutral'} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold text-ink">{row.nama}</span>
                  {row.telepon && <span className="truncate text-[13px] text-ink-muted">{row.telepon}</span>}
                </span>
                {row.perluDilengkapi && <StatusPill tone="warning">Perlu dilengkapi</StatusPill>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {sheet && (
        <SupplierSheet
          open onClose={() => { setSheet(null); setRiwayat(undefined) }} onSubmit={handleSubmit}
          initialValues={sheet.mode === 'edit' ? { nama: sheet.row.nama, telepon: sheet.row.telepon, alamat: sheet.row.alamat, kontak: sheet.row.kontak, catatan: sheet.row.catatan } : undefined}
          riwayat={sheet.mode === 'edit' ? riwayat : undefined}
        />
      )}
    </main>
  )
}
