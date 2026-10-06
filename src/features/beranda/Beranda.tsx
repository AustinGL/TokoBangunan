import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  BellOff,
  ChevronRight,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
} from 'lucide-react'
import { useBeranda } from './useBeranda'
import { useKatalog } from '../shared/useKatalog'
import { usePiutang } from '../piutang/usePiutang'
import { SaleDetail } from '../transaksi/SaleDetail'
import { Button, ButtonLink } from '../../ui/Button'
import { IconButton } from '../../ui/IconButton'
import { Icon } from '../../ui/Icon'
import { DeltaBadge } from '../../ui/DeltaBadge'
import { NumberTicker } from '../../ui/NumberTicker'
import { ProgressRing } from '../../ui/ProgressRing'
import { Sparkline } from '../../ui/Sparkline'
import { StatusPill } from '../../ui/StatusPill'
import { bacaTunda, simpanTunda } from '../../data/tundaStore'
import { buildInbox, type InboxRow } from '../../domain/inbox'
import { pisahTunda, tundaSampaiBesok, type TundaMap } from '../../domain/tunda'
import { deltaPercent } from '../../domain/dashboard'
import { shortNota } from '../../domain/nota'
import { systemClock } from '../../domain/clock'

/**
 * Beranda is a calm overview: today's figures first, then the work that needs
 * attention, then recent activity. Everything sits on flat white surfaces
 * with generous space between groups; hierarchy comes from type size and
 * weight, not from borders, shadows or colour.
 */

const number = new Intl.NumberFormat('id-ID')

const PANEL = 'rounded-card bg-surface shadow-card'

const FIRST_STEPS = [
  { to: '/kamus', title: 'Tambah barang dan ukurannya', hint: 'Nama, ukuran, dan harga eceran.' },
  { to: '/stok?tambah=1', title: 'Catat stok pertama', hint: 'Jumlah dan harga beli untuk menghitung laba.' },
  { to: '/kasir', title: 'Mulai jual di Kasir', hint: 'Cari atau scan barang, lalu simpan transaksi.' },
] as const

/** Entrance order for the page's blocks: each rises in 30ms after the last. */
const stagger = (n: number): CSSProperties => ({ '--stagger': n } as CSSProperties)

function Money({ value, muted = 'text-ink-muted' }: { value: number; muted?: string }) {
  return (
    <span className="tabular-nums">
      <span className={`mr-1 text-sm font-medium ${muted}`}>Rp</span>
      {value < 0 ? '− ' : ''}{number.format(Math.abs(value))}
    </span>
  )
}

function greeting(hour: number): string {
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="px-1 text-lg font-semibold text-ink">{children}</h2>
}

function Metric({ label, children, note }: { label: string; children: ReactNode; note: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-5">
      <span className="text-sm font-medium text-ink-muted">{label}</span>
      <div className="text-xl font-semibold leading-none text-ink">{children}</div>
      <div className="text-xs leading-5 text-ink-muted">{note}</div>
    </div>
  )
}

function InboxRowView({ row }: { row: InboxRow }) {
  const Glyph = row.severity === 'danger' ? AlertCircle : AlertTriangle
  const tone = row.severity === 'danger' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'

  if (row.items.length === 1) {
    return (
      <Link
        to={row.items[0].to}
        viewTransition
        className="group grid min-h-[64px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2 transition-colors duration-instant hover:bg-fill-tertiary active:bg-fill"
      >
        <span className={`flex size-9 items-center justify-center rounded-full ${tone}`}>
          <Icon icon={Glyph} size="button" />
        </span>
        <span className="min-w-0 text-sm font-medium text-ink">{row.title}</span>
        <span className="flex items-center gap-1 text-sm font-medium text-primary-ink">
          {row.aksi} <Icon icon={ChevronRight} size="inline" className="transition-transform duration-quick ease-spring group-hover:translate-x-0.5" />
        </span>
      </Link>
    )
  }

  return (
    <details className="group/details">
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-4 py-2 transition-colors duration-instant hover:bg-fill-tertiary [&::-webkit-details-marker]:hidden">
        <span className={`flex size-9 items-center justify-center rounded-full ${tone}`}>
          <Icon icon={Glyph} size="button" />
        </span>
        <span className="flex-1 text-sm font-medium text-ink">{row.title}</span>
        <span className="text-sm font-medium text-primary-ink">Rincian</span>
        <Icon icon={ChevronRight} size="inline" className="text-ink-faint transition-transform duration-panel ease-spring group-open/details:rotate-90" />
      </summary>
      <ul className="mb-2 ml-16 mr-4 divide-y divide-separator">
        {row.items.map(item => (
          <li key={item.key}>
            <Link to={item.to} viewTransition className="flex min-h-control items-center justify-between gap-3 text-sm transition-colors duration-instant hover:text-primary-ink">
              <span className="text-ink">{item.label}</span>
              <span className="font-medium text-primary-ink">{row.aksi}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}

function BerandaSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-dashboard flex-col gap-8 p-4 md:p-8">
      <h1 className="sr-only">Beranda</h1>
      <div className="flex h-24 flex-col justify-center gap-3" aria-hidden="true">
        <div className="skeleton h-3 w-32 rounded-field" />
        <div className="skeleton h-9 w-56 rounded-field" />
      </div>
      <div className="skeleton h-48 rounded-card-xl" aria-hidden="true" />
      <span className="sr-only" aria-live="polite">Memuat beranda...</span>
    </main>
  )
}

export function Beranda() {
  const data = useBeranda()
  const katalog = useKatalog()
  const piutang = usePiutang()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [tunda, setTunda] = useState<TundaMap>(() => bacaTunda(systemClock.now()))

  const now = systemClock.now()
  const tanggal = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  const firstRun = katalog !== undefined && katalog.length === 0
  const inbox = useMemo(() => (katalog ? buildInbox(katalog, piutang?.pelanggan) : []), [katalog, piutang])
  const { tampil, ditunda } = pisahTunda(inbox, tunda, now)
  const ubahTunda = (next: TundaMap) => { setTunda(next); simpanTunda(next) }
  const tundaBaris = (key: string) => ubahTunda({ ...tunda, [key]: tundaSampaiBesok(systemClock.now()) })
  const tampilkanLagi = () => ubahTunda(Object.fromEntries(Object.entries(tunda).filter(([key]) => !ditunda.some(r => r.key === key))))
  const stock = useMemo(() => {
    const counts = { aman: 0, menipis: 0, habis: 0 }
    for (const b of katalog ?? []) {
      if (b.diarsipkan) continue
      for (const u of b.ukuran) if (!u.diarsipkan) counts[u.status] += 1
    }
    return { ...counts, total: counts.aman + counts.menipis + counts.habis }
  }, [katalog])

  if (data === undefined || katalog === undefined) return <BerandaSkeleton />

  const { summary, recent } = data
  const { hariIni, kemarin, tujuhHari } = summary
  const totalTujuhHari = tujuhHari.reduce((sum, day) => sum + day.penjualan, 0)
  const labaKnown = hariIni.barisDenganModal > 0

  return (
    <main className="mx-auto flex w-full max-w-dashboard flex-col gap-8 p-4 pb-10 md:p-8 md:pb-12">
      <header className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Beranda</h1>
          <p className="mt-1 text-sm text-ink-muted">{greeting(now.getHours())} · {tanggal}</p>
        </div>
        <ButtonLink to="/kasir" variant="primary" icon={ShoppingCart} viewTransition>Transaksi baru</ButtonLink>
      </header>

      <section aria-labelledby="hari-ini" className="flex flex-col gap-3">
        <div id="hari-ini"><SectionLabel>Ringkasan hari ini</SectionLabel></div>
        <div className={`card-in overflow-hidden rounded-card-xl bg-surface shadow-card`} style={stagger(0)}>
          <section className="flex flex-col gap-2 p-6 md:p-8">
            <span className="text-sm font-medium text-ink-muted">Penjualan hari ini</span>
            <div className="text-3xl font-bold leading-none text-ink md:text-[44px] md:leading-[1.05]">
              <NumberTicker value={hariIni.penjualan}><Money value={hariIni.penjualan} muted="text-ink-muted" /></NumberTicker>
            </div>
            <span className="text-sm text-ink-muted">{hariIni.jumlah} transaksi</span>
          </section>

          <div className="grid divide-y divide-separator border-t border-separator sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Metric
              label="Jumlah transaksi"
              note={kemarin.jumlah === 0 ? 'Kemarin belum ada transaksi.' : <><DeltaBadge value={deltaPercent(hariIni.jumlah, kemarin.jumlah)} /> <span className="ml-1">dari kemarin ({kemarin.jumlah})</span></>}
            >
              <span className="tabular-nums">{hariIni.jumlah}</span>
            </Metric>

            <Metric
              label="Laba hari ini"
              note={hariIni.barisTotal === 0 ? 'Belum ada penjualan hari ini.' : `${hariIni.barisDenganModal} dari ${hariIni.barisTotal} baris punya harga beli.`}
            >
              {labaKnown ? <Money value={hariIni.laba} /> : <span aria-label="Belum diketahui">−</span>}
            </Metric>

            <Metric
              label="Piutang berjalan"
              note={
                piutang === undefined ? 'Memuat...'
                : piutang.jumlahPelanggan === 0 ? 'Belum ada piutang.'
                : (
                  <Link to="/piutang" viewTransition className="font-medium text-primary-ink underline-offset-2 hover:underline">
                    {piutang.jumlahPelanggan} pelanggan{piutang.jumlahLewatTempo > 0 ? `, ${piutang.jumlahLewatTempo} lewat tempo` : ''}
                  </Link>
                )
              }
            >
              {piutang === undefined ? <span aria-label="Memuat">−</span> : <Money value={piutang.totalSisa} />}
            </Metric>
          </div>
        </div>
      </section>

      <section aria-labelledby="tindakan" className="flex flex-col gap-3">
        <div id="tindakan"><SectionLabel>Perlu perhatian</SectionLabel></div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
          <section className={`card-in ${PANEL} overflow-hidden`} style={stagger(1)}>
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div>
                <h3 className="text-lg font-semibold text-ink">{firstRun ? 'Mulai di sini' : 'Perlu diurus'}</h3>
                <p className="mt-0.5 text-xs text-ink-muted">{firstRun ? 'Tiga langkah agar toko siap dipakai.' : 'Masalah yang paling cepat memengaruhi penjualan.'}</p>
              </div>
              <span className="rounded-pill bg-fill px-2.5 py-1 text-2xs font-semibold tabular-nums text-ink">{firstRun ? '3 langkah' : `${tampil.length} item`}</span>
            </div>

            {firstRun ? (
              <ol className="divide-y divide-separator border-t border-separator">
                {FIRST_STEPS.map(step => (
                  <li key={step.to}>
                    <Link to={step.to} viewTransition className="group grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 transition-colors duration-instant hover:bg-fill-tertiary active:bg-fill">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{step.title}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-ink-muted">{step.hint}</span>
                      </span>
                      <Icon icon={ChevronRight} size="inline" className="text-ink-faint transition-transform duration-quick ease-spring group-hover:translate-x-1 group-hover:text-primary-ink" />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : tampil.length === 0 && ditunda.length === 0 ? (
              <div className="flex min-h-[164px] items-center gap-4 border-t border-separator px-5 py-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-success-bg text-success"><Icon icon={PackageCheck} size="nav" /></span>
                <p className="text-sm text-ink-muted">
                  <strong className="block text-base font-semibold text-ink">Semua beres. Tidak ada yang perlu diurus hari ini.</strong>
                </p>
              </div>
            ) : (
              <>
                {tampil.length === 0 ? (
                  <p className="border-t border-separator px-5 py-6 text-sm text-ink-muted">Semua yang perlu diurus sedang ditunda.</p>
                ) : (
                  <div className="divide-y divide-separator border-t border-separator">
                    {tampil.map(row => (
                      <div key={row.key} className="flex items-center">
                        <div className="min-w-0 flex-1"><InboxRowView row={row} /></div>
                        <IconButton
                          icon={BellOff} variant="ghost" label={`Tunda sampai besok: ${row.title}`}
                          className="mr-2" onClick={() => tundaBaris(row.key)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {ditunda.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator px-5 py-3 text-xs text-ink-muted">
                    <span>{ditunda.length} item ditunda sampai besok.</span>
                    <Button variant="link" onClick={tampilkanLagi}>Tampilkan lagi</Button>
                  </div>
                )}
              </>
            )}
          </section>

          <section className={`card-in ${PANEL} flex flex-col p-5`} style={stagger(2)}>
            <div>
              <h3 className="text-lg font-semibold text-ink">Ringkasan stok</h3>
              <p className="mt-0.5 text-xs text-ink-muted">Kondisi semua ukuran aktif.</p>
            </div>
            <div className="my-6 flex flex-1 items-center gap-6">
              <ProgressRing value={stock.total === 0 ? 0 : stock.aman / stock.total}>
                <span className="text-xl font-bold tabular-nums text-ink">{stock.aman}</span>
                <span className="text-2xs font-medium text-ink-muted">aman</span>
              </ProgressRing>
              <dl className="flex flex-1 flex-col gap-2.5 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-ink-muted">Aman</dt><dd className="font-semibold tabular-nums text-success">{stock.aman}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-muted">Menipis</dt><dd className="font-semibold tabular-nums text-warning">{stock.menipis}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-muted">Habis</dt><dd className="font-semibold tabular-nums text-danger">{stock.habis}</dd></div>
              </dl>
            </div>
            {/* Repeated as plain text for the compact, explicit stock-health contract. */}
            <div className="sr-only">
              <span>{stock.aman} aman</span>
              <span>{stock.menipis} menipis</span>
              <span>{stock.habis} habis</span>
            </div>
            <Link to="/stok" viewTransition className="inline-flex min-h-control items-center justify-between border-t border-separator pt-3 text-sm font-medium text-primary-ink">
              Buka Stok <Icon icon={ChevronRight} size="inline" />
            </Link>
          </section>
        </div>
      </section>

      <section aria-labelledby="catatan" className="flex flex-col gap-3">
        <div id="catatan"><SectionLabel>Aktivitas</SectionLabel></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`card-in ${PANEL} flex min-h-[220px] flex-col p-5`} style={stagger(3)}>
            <h3 className="text-sm font-medium text-ink-muted">Penjualan 7 hari</h3>
            <div className="mt-2 text-2xl font-bold leading-none text-ink"><Money value={totalTujuhHari} /></div>
            <div className="mt-auto pt-6">
              <Sparkline values={tujuhHari.map(day => day.penjualan)} width={420} height={72} />
            </div>
            <p className="mt-3 text-xs text-ink-muted">Total 7 hari terakhir, termasuk hari ini.</p>
          </section>

          <section className={`card-in ${PANEL} flex min-h-[220px] flex-col p-5`} style={stagger(4)}>
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-ink">Transaksi terakhir</h3>
              <Link to="/transaksi" viewTransition className="inline-flex min-h-control items-center gap-0.5 text-sm font-medium text-primary-ink">Lihat semua <Icon icon={ChevronRight} size="inline" /></Link>
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-1 items-center gap-3 py-5 text-sm text-ink-muted">
                <Icon icon={ReceiptText} size="nav" /> Belum ada transaksi.
              </div>
            ) : (
              <ul className="-mx-2 mt-1 flex flex-col">
                {recent.map(sale => (
                  <li key={sale.id}>
                    <button
                      type="button"
                      onClick={() => setDetailId(sale.id)}
                      className="press grid min-h-[60px] w-full grid-cols-[1fr_auto] items-center gap-3 rounded-field px-2 text-left hover:bg-fill-tertiary"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold tabular-nums text-ink">{shortNota(sale.id)}</span>
                        <span className="mt-0.5 block text-2xs text-ink-muted">{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(sale.occurredAt))}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink"><Money value={sale.total} /></span>
                        <StatusPill tone={sale.status === 'aktif' ? 'success' : 'neutral'}>{sale.status === 'aktif' ? 'Aktif' : 'Batal'}</StatusPill>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>

      {detailId && <SaleDetail saleId={detailId} onClose={() => setDetailId(null)} />}
    </main>
  )
}
