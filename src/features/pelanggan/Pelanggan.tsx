import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useDaftarPelanggan } from './usePelanggan'
import { PelangganSheet, type PelangganSheetValues } from './PelangganSheet'
import { recordCustomer } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { formatRupiah, rupiah } from '../../domain/money'
import { cariPelanggan } from '../../domain/pelanggan'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Icon } from '../../ui/Icon'
import { IconTile } from '../../ui/IconTile'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { PageHeader } from '../../ui/PageHeader'
import { SearchField } from '../../ui/SearchField'
import { StatusPill } from '../../ui/StatusPill'
import { CustomerIcon } from '../../ui/BrandIcons'

/**
 * Every customer, including ones who owe nothing (Piutang lists only debtors).
 * Name and phone are found and fixed here and on the customer's own page.
 */
export function Pelanggan() {
  const rows = useDaftarPelanggan()
  const [query, setQuery] = useState('')
  const [tambah, setTambah] = useState(false)
  const tampil = useMemo(() => cariPelanggan(rows ?? [], query), [rows, query])

  // Left to throw: PelangganSheet shows the failure inside its own open dialog.
  const simpan = async (values: PelangganSheetValues) => {
    await recordCustomer(
      { nama: values.nama, telepon: values.telepon ?? undefined, alamat: values.alamat ?? undefined },
      { clock: systemClock, deviceId: getDeviceId() },
    )
    setTambah(false)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 pb-10 md:p-8 md:pb-12">
      <PageHeader
        title="Pelanggan"
        subtitle={rows !== undefined ? `${rows.length} pelanggan` : undefined}
        action={<Button variant="primary" onClick={() => setTambah(true)}>+ Pelanggan baru</Button>}
      />

      {rows === undefined ? (
        <ListSkeleton label="Memuat daftar pelanggan..." rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CustomerIcon}>Belum ada pelanggan. Pelanggan baru muncul di sini saat Anda menjual dengan Bon.</EmptyState>
      ) : (
        <>
          <SearchField id="cari-pelanggan" label="Cari pelanggan" placeholder="Cari nama atau telepon" value={query} onChange={setQuery} />
          {tampil.length === 0 ? (
            <p className="px-1 text-sm text-ink-muted">Tidak ada pelanggan yang cocok dengan pencarian ini.</p>
          ) : (
            <ul aria-label="Daftar pelanggan" className="card-in divide-y divide-separator overflow-hidden rounded-card bg-surface shadow-card">
              {tampil.map(r => {
                return (
                  <li key={r.id}>
                    <Link
                      to={`/pelanggan/${r.id}`}
                      className="group grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 transition-colors duration-instant hover:bg-fill-tertiary active:bg-fill"
                    >
                      <IconTile icon={CustomerIcon} tone="primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{r.nama}</span>
                        {r.telepon && <span className="block truncate text-xs text-ink-muted">{r.telepon}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        {r.kelebihan > 0 && <StatusPill tone="warning">Kelebihan bayar {formatRupiah(rupiah(r.kelebihan))}</StatusPill>}
                        {r.totalSisa > 0 ? (
                          <span className="flex flex-col items-end gap-1">
                            <span className="text-sm font-semibold tabular-nums text-ink">{formatRupiah(rupiah(r.totalSisa))}</span>
                            {r.status === 'lewat' && <StatusPill tone="danger">Lewat tempo</StatusPill>}
                          </span>
                        ) : (
                          <StatusPill tone="neutral">Tidak ada piutang</StatusPill>
                        )}
                        <Icon icon={ChevronRight} size="inline" className="text-ink-faint transition-transform duration-quick ease-spring group-hover:translate-x-1" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {tambah && <PelangganSheet open onClose={() => setTambah(false)} onSubmit={simpan} />}
    </main>
  )
}
