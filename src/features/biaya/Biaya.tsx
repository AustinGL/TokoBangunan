import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { labelBiaya } from './labelBiaya'
import { BiayaSheet } from './BiayaSheet'
import { formatTanggal } from '../shared/formatTanggal'
import { batalkanBiaya } from '../../data/commands'
import { db } from '../../data/db'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { formatRupiah, rupiah } from '../../domain/money'
import type { Expense } from '../../domain/projections/expenses'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { PageHeader } from '../../ui/PageHeader'
import { StatusPill } from '../../ui/StatusPill'
import { WalletIcon } from '../../ui/BrandIcons'

const PANEL = 'rounded-card bg-surface shadow-card'

const bulanIni = (iso: string): boolean => {
  const d = new Date(iso)
  const now = systemClock.now()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

/** Operating expenses (gaji, sewa, listrik...), newest first. Feeds Laporan's laba bersih. */
export function Biaya() {
  const biaya = useLiveQuery(
    async () => (await db.expensesProj.toArray()).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id)),
    [],
  )
  const [sheet, setSheet] = useState<{ awal?: Expense } | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalBulanIni = (biaya ?? []).filter(b => b.status === 'aktif' && bulanIni(b.occurredAt)).reduce((sum, b) => sum + b.jumlah, 0)

  const batalkan = async (b: Expense) => {
    setError(null)
    try {
      await batalkanBiaya(b.id, { clock: systemClock, deviceId: getDeviceId() })
    } catch {
      setError('Biaya gagal dibatalkan. Coba lagi.')
    } finally {
      setKonfirmasi(null)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-10 md:p-8 md:pb-12">
      <PageHeader
        title="Biaya operasional"
        action={<Button variant="primary" onClick={() => setSheet({})}>+ Biaya baru</Button>}
      />

      {biaya === undefined ? (
        <ListSkeleton label="Memuat biaya..." rows={3} />
      ) : biaya.length === 0 ? (
        <EmptyState icon={WalletIcon}>Belum ada biaya. Catat gaji, sewa, listrik, dan biaya lain di sini supaya Laporan bisa menghitung laba bersih.</EmptyState>
      ) : (
        <>
          <section className={`card-in ${PANEL} flex flex-col gap-1 p-6`}>
            <span className="text-sm font-medium text-ink-muted">Biaya bulan ini</span>
            <span className="text-3xl font-bold tabular-nums text-ink">{formatRupiah(rupiah(totalBulanIni))}</span>
          </section>

          {error && (
            <p role="alert" className="rounded-field border border-danger bg-danger-bg p-3 text-sm font-semibold text-danger">{error}</p>
          )}

          <ul aria-label="Daftar biaya" className={`card-in ${PANEL} divide-y divide-separator`}>
            {biaya.map(b => {
              const batal = b.status === 'batal'
              return (
                <li key={b.id} className="flex flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${batal ? 'text-ink-muted line-through' : 'text-ink'}`}>{labelBiaya(b.kategori)}</p>
                      <p className="text-xs text-ink-muted">{formatTanggal(b.occurredAt)}</p>
                      {b.catatan && <p className="text-xs text-ink-muted">{b.catatan}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-sm font-semibold tabular-nums ${batal ? 'text-ink-muted line-through' : 'text-ink'}`}>{formatRupiah(rupiah(b.jumlah))}</span>
                      {batal && <StatusPill tone="neutral">Dibatalkan</StatusPill>}
                    </div>
                  </div>
                  {!batal && (konfirmasi === b.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ink-muted">Batalkan biaya ini?</span>
                      <Button variant="danger" size="sm" onClick={() => batalkan(b)}>Ya, batalkan</Button>
                      <Button variant="secondary" size="sm" onClick={() => setKonfirmasi(null)}>Tidak</Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-4">
                      <Button variant="link" aria-label={`Ubah biaya ${labelBiaya(b.kategori)}`} onClick={() => setSheet({ awal: b })}>
                        Ubah
                      </Button>
                      <Button variant="link" aria-label={`Batalkan biaya ${labelBiaya(b.kategori)}`} onClick={() => setKonfirmasi(b.id)}>
                        Batalkan
                      </Button>
                    </div>
                  ))}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {sheet && <BiayaSheet open onClose={() => setSheet(null)} awal={sheet.awal} />}
    </main>
  )
}
