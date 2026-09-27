import { useMemo, useState } from 'react'
import { useSuppliers } from '../shared/useSuppliers'
import { SupplierSheet, type SupplierSheetValues, type RiwayatBatch } from './SupplierSheet'
import { recordSupplier, updateSupplier } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { db } from '../../data/db'
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
  const visible = useMemo(() => {
    if (!suppliers) return []
    return reviewOnly ? suppliers.filter(s => s.perluDilengkapi) : suppliers
  }, [suppliers, reviewOnly])

  const openEdit = async (row: SupplierRow) => {
    const batches = await db.batchesProj.where('supplierId').equals(row.id).toArray()
    setRiwayat(batches.map(b => ({ batchId: b.batchId, tanggalBeli: b.tanggalBeli, itemId: b.itemId })))
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
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[17px] font-bold text-ink">Supplier</h1>
        <button
          type="button"
          onClick={() => setSheet({ mode: 'create' })}
          className="min-h-tap rounded-tile bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
        >
          + Supplier baru
        </button>
      </div>

      {perluDilengkapiCount > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-card border border-warning bg-warning-bg p-4">
          <p className="text-[14px] font-medium text-warning">
            {perluDilengkapiCount} supplier baru perlu dilengkapi
          </p>
          <button
            type="button"
            onClick={() => setReviewOnly(true)}
            className="min-h-tap rounded-tile bg-surface px-3 text-[13px] font-semibold text-warning"
          >
            Tinjau
          </button>
        </div>
      )}

      {suppliers === undefined ? (
        <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Memuat daftar supplier...
        </div>
      ) : suppliers.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Belum ada supplier. Mulai tambahkan supplier.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map(row => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="flex min-h-tap w-full items-center justify-between gap-4 rounded-card border border-border bg-surface p-4 text-left"
              >
                <div className="flex flex-col">
                  <span className="text-[14px] font-semibold text-ink">{row.nama}</span>
                  {row.telepon && <span className="text-[13px] text-ink-muted">{row.telepon}</span>}
                </div>
                {row.perluDilengkapi && (
                  <span className="inline-flex items-center rounded-[var(--r-pill)] bg-warning-bg px-[10px] py-[4px] text-[12px] font-semibold text-warning">
                    Perlu dilengkapi
                  </span>
                )}
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
