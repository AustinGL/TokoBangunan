import { Link } from 'react-router-dom'
import { ChevronRight, Wallet } from 'lucide-react'
import { usePiutang } from './usePiutang'
import { usePengingat } from './usePengingat'
import { formatTanggal } from '../shared/formatTanggal'
import { labelStatus } from './statusLabel'
import { formatRupiah, rupiah } from '../../domain/money'
import { ButtonLink } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Icon } from '../../ui/Icon'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { PageHeader } from '../../ui/PageHeader'
import { StatusPill } from '../../ui/StatusPill'

/**
 * Who owes what, most urgent first (lewat tempo, then segera, then berjalan).
 * Customers with nothing left to pay are not listed.
 */
export function Piutang() {
  const data = usePiutang()
  const pengingat = usePengingat()

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-10 md:p-8 md:pb-12">
      <PageHeader title="Piutang" />
      {data === undefined ? (
        <ListSkeleton label="Memuat piutang..." rows={3} />
      ) : data.pelanggan.length === 0 ? (
        <EmptyState icon={Wallet} action={<ButtonLink to="/kasir" variant="secondary">Buka Kasir</ButtonLink>}>
          Belum ada piutang. Bon dari Kasir akan muncul di sini.
        </EmptyState>
      ) : (
        <>
          <section className="card-in flex flex-col gap-1 rounded-card bg-surface p-6 shadow-card">
            <span className="text-sm font-medium text-ink-muted">Total piutang berjalan</span>
            <span className="text-3xl font-bold tabular-nums text-ink">{formatRupiah(rupiah(data.totalSisa))}</span>
            <span className="text-xs text-ink-muted">
              {data.jumlahPelanggan} pelanggan{data.jumlahLewatTempo > 0 ? ` · ${data.jumlahLewatTempo} lewat tempo` : ''}
            </span>
          </section>

          <ul aria-label="Daftar piutang" className="card-in divide-y divide-separator overflow-hidden rounded-card bg-surface shadow-card">
            {data.pelanggan.map(p => {
              const status = labelStatus(p)
              return (
                <li key={p.customerId}>
                  <Link
                    to={`/piutang/${p.customerId}`}
                    className="group grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 transition-colors duration-instant hover:bg-fill-tertiary active:bg-fill"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{p.nama}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <StatusPill tone={status.tone}>{status.text}</StatusPill>
                        <span>{p.jumlahNota} nota</span>
                        {pengingat?.[p.customerId] && <span>Diingatkan {formatTanggal(pengingat[p.customerId].terakhir)}</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-ink">{formatRupiah(rupiah(p.totalSisa))}</span>
                      <Icon icon={ChevronRight} size="inline" className="text-ink-faint transition-transform duration-quick ease-spring group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </main>
  )
}
