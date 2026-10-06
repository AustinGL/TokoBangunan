import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { usePiutang } from './usePiutang'
import { usePengingat } from './usePengingat'
import { labelStatus } from './statusLabel'
import { CatatPembayaranSheet, type PembayaranMode } from './CatatPembayaranSheet'
import { SaleDetail } from '../transaksi/SaleDetail'
import { PelangganSheet, type PelangganSheetValues } from '../pelanggan/PelangganSheet'
import { NamaTokoSheet } from './NamaTokoSheet'
import { useNamaToko } from '../shared/useNamaToko'
import { useCustomers } from '../shared/useCustomers'
import { formatTanggal, formatTanggalKey } from '../shared/formatTanggal'
import { aturNamaToko, catatPengingat, updateCustomer } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { formatRupiah, rupiah } from '../../domain/money'
import { linkWhatsApp, nomorWhatsApp, pesanPengingat } from '../../domain/pengingat'
import { shortNota } from '../../domain/nota'
import { Button, ButtonLink, buttonClass } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { PageHeader } from '../../ui/PageHeader'
import { StatusPill } from '../../ui/StatusPill'

const PANEL = 'rounded-card bg-surface shadow-card'

/** One customer: what they owe, nota by nota, and their payment history. */
export function PiutangDetail() {
  const { customerId } = useParams<{ customerId: string }>()
  const data = usePiutang()
  const [pembayaran, setPembayaran] = useState<PembayaranMode | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [ubahKontak, setUbahKontak] = useState(false)
  const [ubahToko, setUbahToko] = useState(false)
  const customers = useCustomers()
  const namaToko = useNamaToko()
  const pengingat = usePengingat()

  if (data === undefined) {
    return (
      <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <ListSkeleton label="Memuat piutang..." rows={3} />
      </main>
    )
  }

  const p = data.pelanggan.find(x => x.customerId === customerId)
  if (!p) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
        <PageHeader title="Piutang" />
        <EmptyState icon={Wallet} action={<ButtonLink to="/piutang">Kembali ke Piutang</ButtonLink>}>
          Pelanggan ini tidak punya piutang.
        </EmptyState>
      </main>
    )
  }

  const customer = customers?.find(c => c.id === p.customerId)
  const nomor = nomorWhatsApp(p.telepon)
  const terakhir = pengingat?.[p.customerId]
  // Only a note: opening WhatsApp is all the app can know. A failure to note must never block the link.
  const catatKirim = () => { void catatPengingat(p.customerId, { clock: systemClock, deviceId: getDeviceId() }).catch(() => {}) }

  // Left to throw: PelangganSheet shows the failure inside its own open dialog.
  const simpanKontak = async (values: PelangganSheetValues) => {
    await updateCustomer(
      { id: p.customerId, nama: values.nama, telepon: values.telepon, alamat: values.alamat },
      { clock: systemClock, deviceId: getDeviceId() },
    )
    setUbahKontak(false)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-10 md:p-8 md:pb-12">
      <PageHeader
        title={p.nama}
        subtitle={p.telepon}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {nomor ? (
              <a
                href={linkWhatsApp(nomor, pesanPengingat(p, systemClock.now().getHours(), namaToko ?? undefined))}
                target="_blank" rel="noopener noreferrer" onClick={catatKirim}
                className={buttonClass('secondary', 'md')}
              >
                Kirim pengingat
              </a>
            ) : (
              // No usable WhatsApp number: the same button asks for one instead of failing.
              <Button variant="secondary" onClick={() => setUbahKontak(true)}>Kirim pengingat</Button>
            )}
            <Button variant="primary" onClick={() => setPembayaran({ kind: 'terlama', customerId: p.customerId, nota: p.nota, totalSisa: p.totalSisa })}>
              Lunasi dari yang terlama
            </Button>
          </div>
        }
      />

      {terakhir && (
        <p className="-mt-2 text-sm text-ink-muted">
          Terakhir diingatkan {formatTanggal(terakhir.terakhir)} ({terakhir.jumlah} kali)
        </p>
      )}

      {/* Nothing while the name is still loading, so the line never flashes "not set". */}
      {namaToko !== null && (
        <p className="-mt-2 flex flex-wrap items-center gap-x-1 text-sm text-ink-muted">
          {namaToko === '' ? 'Pesan belum menyebut nama toko.' : <>Pesan dikirim atas nama <strong className="font-semibold text-ink">{namaToko}</strong>.</>}
          <Button variant="link" onClick={() => setUbahToko(true)}>{namaToko === '' ? 'Atur nama toko' : 'Ubah'}</Button>
        </p>
      )}

      <section className={`card-in ${PANEL} flex flex-col gap-1 p-6`}>
        <span className="text-sm font-medium text-ink-muted">Total sisa</span>
        <span className="text-3xl font-bold tabular-nums text-ink">{formatRupiah(rupiah(p.totalSisa))}</span>
        <span className="text-xs text-ink-muted">{p.jumlahNota} nota belum lunas</span>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-lg font-semibold text-ink">Nota belum lunas</h2>
        <ul aria-label="Nota belum lunas" className={`card-in ${PANEL} divide-y divide-separator`}>
          {p.nota.map(n => {
            const status = labelStatus(n)
            const nomor = shortNota(n.saleId)
            return (
              <li key={n.saleId} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setDetailId(n.saleId)}
                      className="min-h-control text-left text-sm font-semibold tabular-nums text-primary-ink underline-offset-2 hover:underline"
                    >
                      {nomor}
                    </button>
                    <p className="text-xs text-ink-muted">
                      {formatTanggal(n.occurredAt)} · Jatuh tempo {formatTanggalKey(n.jatuhTempo)}
                    </p>
                  </div>
                  <StatusPill tone={status.tone}>{status.text}</StatusPill>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div><dt className="text-ink-muted">Total</dt><dd className="font-semibold tabular-nums text-ink">{formatRupiah(rupiah(n.total))}</dd></div>
                  <div><dt className="text-ink-muted">Dibayar</dt><dd className="font-semibold tabular-nums text-ink">{formatRupiah(rupiah(n.dibayar))}</dd></div>
                  <div><dt className="text-ink-muted">Sisa</dt><dd className="font-semibold tabular-nums text-ink">{formatRupiah(rupiah(n.sisa))}</dd></div>
                </dl>
                <Button
                  variant="secondary" size="sm" className="self-start"
                  aria-label={`Catat pembayaran ${nomor}`}
                  onClick={() => setPembayaran({ kind: 'nota', saleId: n.saleId, nomor, sisa: n.sisa, occurredAt: n.occurredAt })}
                >
                  Catat pembayaran
                </Button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-lg font-semibold text-ink">Riwayat pembayaran</h2>
        {p.pembayaran.length === 0 ? (
          <p className="px-1 text-sm text-ink-muted">Belum ada pembayaran.</p>
        ) : (
          <ul aria-label="Riwayat pembayaran" className={`card-in ${PANEL} divide-y divide-separator`}>
            {p.pembayaran.map(b => (
              <li key={b.id} className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0 text-sm text-ink-muted">
                  <p>{formatTanggal(b.occurredAt)} · <span className="tabular-nums">{shortNota(b.saleId)}</span></p>
                  {b.catatan && <p className="text-xs">{b.catatan}</p>}
                </div>
                <span className="text-sm font-semibold tabular-nums text-ink">{formatRupiah(rupiah(b.jumlah))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ubahToko && (
        <NamaTokoSheet
          open onClose={() => setUbahToko(false)} namaAwal={namaToko ?? ''}
          onSubmit={async nama => {
            await aturNamaToko({ nama }, { clock: systemClock, deviceId: getDeviceId() })
            setUbahToko(false)
          }}
        />
      )}
      {ubahKontak && (
        <PelangganSheet
          open onClose={() => setUbahKontak(false)} onSubmit={simpanKontak}
          initialValues={{ nama: customer?.nama ?? '', telepon: customer?.telepon, alamat: customer?.alamat }}
          hint="Tambahkan nomor WhatsApp dulu."
        />
      )}
      {pembayaran && <CatatPembayaranSheet open onClose={() => setPembayaran(null)} mode={pembayaran} />}
      {detailId && <SaleDetail saleId={detailId} onClose={() => setDetailId(null)} />}
    </main>
  )
}
