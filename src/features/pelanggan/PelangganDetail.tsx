import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { PelangganSheet, type PelangganSheetValues } from './PelangganSheet'
import { useDetailPelanggan } from './usePelanggan'
import { SaleDetail } from '../transaksi/SaleDetail'
import { formatTanggal, formatTanggalKey } from '../shared/formatTanggal'
import { updateCustomer } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { formatRupiah, rupiah } from '../../domain/money'
import { shortNota } from '../../domain/nota'
import { Button, ButtonLink } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { PageHeader } from '../../ui/PageHeader'
import { StatusPill } from '../../ui/StatusPill'
import { CustomerIcon } from '../../ui/BrandIcons'

const PANEL = 'rounded-card bg-surface shadow-card'

/** One customer: contact details, what they owe, and every Bon they ever took. */
export function PelangganDetail() {
  const { customerId } = useParams<{ customerId: string }>()
  const data = useDetailPelanggan(customerId)
  const [ubah, setUbah] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  if (data === undefined) {
    return (
      <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <ListSkeleton label="Memuat pelanggan..." rows={3} />
      </main>
    )
  }
  const { customer } = data
  if (!customer) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
        <PageHeader title="Pelanggan" />
        <EmptyState icon={CustomerIcon} action={<ButtonLink to="/pelanggan">Kembali ke Pelanggan</ButtonLink>}>
          Pelanggan tidak ditemukan.
        </EmptyState>
      </main>
    )
  }

  // Left to throw: PelangganSheet shows the failure inside its own open dialog.
  const simpan = async (values: PelangganSheetValues) => {
    await updateCustomer(
      { id: customer.id, nama: values.nama, telepon: values.telepon, alamat: values.alamat },
      { clock: systemClock, deviceId: getDeviceId() },
    )
    setUbah(false)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-10 md:p-8 md:pb-12">
      <PageHeader
        title={customer.nama}
        subtitle={
          <span className="flex flex-col">
            {customer.telepon && <span>{customer.telepon}</span>}
            {customer.alamat && <span>{customer.alamat}</span>}
          </span>
        }
        action={<Button variant="secondary" onClick={() => setUbah(true)}>Ubah</Button>}
      />

      {data.kelebihan > 0 && (
        <p role="alert" className="rounded-field border border-warning bg-warning-bg p-4 text-sm font-semibold text-warning">
          Kelebihan bayar {formatRupiah(rupiah(data.kelebihan))}. Pembayaran yang sama kemungkinan dicatat dua kali di dua perangkat. Cek riwayat pembayaran dan kembalikan kelebihannya ke pelanggan.
        </p>
      )}

      <section className={`card-in ${PANEL} flex flex-col gap-1 p-6`}>
        <span className="text-sm font-medium text-ink-muted">Sisa piutang</span>
        {data.totalSisa > 0 ? (
          <>
            <span className="text-3xl font-bold tabular-nums text-ink">{formatRupiah(rupiah(data.totalSisa))}</span>
            <ButtonLink to={`/piutang/${customer.id}`} variant="secondary" className="mt-3 self-start">Buka piutang</ButtonLink>
          </>
        ) : (
          <span className="text-xl font-semibold text-ink">Tidak ada piutang</span>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-lg font-semibold text-ink">Riwayat Bon</h2>
        {data.nota.length === 0 ? (
          <p className="px-1 text-sm text-ink-muted">Belum ada Bon.</p>
        ) : (
          <ul aria-label="Riwayat Bon" className={`card-in ${PANEL} divide-y divide-separator`}>
            {data.nota.map(n => (
              <li key={n.saleId} className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <button
                    type="button" onClick={() => setDetailId(n.saleId)}
                    className="min-h-control text-left text-sm font-semibold tabular-nums text-primary-ink underline-offset-2 hover:underline"
                  >
                    {shortNota(n.saleId)}
                  </button>
                  <p className="text-xs text-ink-muted">
                    {formatTanggal(n.occurredAt)} · Jatuh tempo {formatTanggalKey(n.jatuhTempo)}
                  </p>
                  <p className="text-xs text-ink-muted tabular-nums">
                    Total {formatRupiah(rupiah(n.total))} · Dibayar {formatRupiah(rupiah(n.dibayar))}
                  </p>
                  {n.lebih > 0 && <p className="text-xs font-semibold text-warning tabular-nums">Kelebihan bayar {formatRupiah(rupiah(n.lebih))}</p>}
                </div>
                {n.sisa === 0
                  ? <StatusPill tone="success">Lunas</StatusPill>
                  : <span className="text-sm font-semibold tabular-nums text-ink">{formatRupiah(rupiah(n.sisa))}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.pembayaran.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-lg font-semibold text-ink">Riwayat pembayaran</h2>
          <ul aria-label="Riwayat pembayaran" className={`card-in ${PANEL} divide-y divide-separator`}>
            {data.pembayaran.map(b => (
              <li key={b.id} className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0 text-sm text-ink-muted">
                  <p>{formatTanggal(b.occurredAt)} · <span className="tabular-nums">{shortNota(b.saleId)}</span></p>
                  {b.catatan && <p className="text-xs">{b.catatan}</p>}
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">{formatRupiah(rupiah(b.jumlah))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ubah && (
        <PelangganSheet
          open onClose={() => setUbah(false)} onSubmit={simpan}
          initialValues={{ nama: customer.nama, telepon: customer.telepon, alamat: customer.alamat }}
        />
      )}
      {detailId && <SaleDetail saleId={detailId} onClose={() => setDetailId(null)} />}
    </main>
  )
}
