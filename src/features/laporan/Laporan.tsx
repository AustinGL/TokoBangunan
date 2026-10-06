import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { useLaporan } from './useLaporan'
import { labelBiaya } from '../biaya/labelBiaya'
import { deltaPercent } from '../../domain/dashboard'
import { systemClock } from '../../domain/clock'
import { rentangLaporan, presetUntuk, type MetodeUangMasuk, type LaporanPilihan, type LaporanPreset, type LaporanRingkasan, type Rentang } from '../../domain/laporan'
import { formatRupiah, rupiah } from '../../domain/money'
import { dateAtLocalNoon, todayIsoDate } from '../../domain/tanggal'
import { DateRangePicker } from '../../ui/DateRangePicker'
import { DeltaBadge } from '../../ui/DeltaBadge'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { PageHeader } from '../../ui/PageHeader'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { Sparkline } from '../../ui/Sparkline'

const PRESETS: Array<{ value: LaporanPreset; label: string }> = [
  { value: 'hari-ini', label: 'Hari ini' },
  { value: 'bulan-ini', label: 'Bulan ini' },
  { value: 'tahun-ini', label: 'Tahun ini' },
]

const JUDUL: Record<LaporanPreset, string> = {
  'hari-ini': 'hari ini',
  'bulan-ini': 'bulan ini',
  'tahun-ini': 'tahun ini',
}

const LABEL_METODE: Record<MetodeUangMasuk, string> = {
  tunai: 'Tunai', transfer: 'Transfer', qris: 'QRIS', bon: 'Bon (uang muka dan cicilan)',
}

const number = new Intl.NumberFormat('id-ID')
const qtyFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 })
const tanggal = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

const PANEL = 'rounded-card bg-surface shadow-card'
const stagger = (n: number): CSSProperties => ({ '--stagger': n } as CSSProperties)

function Money({ value }: { value: number }) {
  return (
    <span className="tabular-nums">
      <span className="mr-1 text-sm font-medium text-ink-muted">Rp</span>
      {value < 0 ? '− ' : ''}{number.format(Math.abs(value))}
    </span>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="px-1 text-lg font-semibold text-ink">{children}</h2>
}

function labaNote(s: LaporanRingkasan): string {
  if (s.barisTotal === 0) return 'Belum ada penjualan pada periode ini.'
  if (s.labaKotor === null) return 'Harga beli belum tercatat, laba belum bisa dihitung.'
  if (s.barisDenganModal < s.barisTotal) return `${s.barisDenganModal} dari ${s.barisTotal} baris punya harga beli. Laba hanya dari baris tersebut.`
  return `Semua ${s.barisTotal} baris punya harga beli.`
}

const labelRentang = (r: Rentang): string =>
  r.from === r.to
    ? tanggal.format(dateAtLocalNoon(r.from))
    : `${tanggal.format(dateAtLocalNoon(r.from))} – ${tanggal.format(dateAtLocalNoon(r.to))}`

export function Laporan() {
  const [pilihan, setPilihan] = useState<LaporanPilihan>('bulan-ini')
  const data = useLaporan(pilihan)
  const hariIni = todayIsoDate(systemClock)
  const rentang = rentangLaporan(pilihan, systemClock.now()).sekarang
  const judul = typeof pilihan === 'string' ? JUDUL[pilihan] : labelRentang(pilihan)

  // A range picked by hand that equals a shortcut is stored as that shortcut, so
  // it lights up and the previous period is compared the way that shortcut does.
  const pilihRentang = (r: Rentang) => setPilihan(presetUntuk(r, systemClock.now()) ?? r)

  return (
    <main className="mx-auto flex w-full max-w-dashboard flex-col gap-6 p-4 pb-10 md:p-8 md:pb-12">
      <PageHeader title="Laporan" subtitle={data ? labelRentang(data.rentang) : undefined} />
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label="Pilih periode"
          options={PRESETS}
          value={typeof pilihan === 'string' ? pilihan : null}
          onChange={next => setPilihan(next as LaporanPreset)}
        />
        <div className="w-full sm:w-80">
          <DateRangePicker id="laporan-rentang" label="Rentang tanggal" hideLabel value={rentang} onChange={pilihRentang} max={hariIni} />
        </div>
      </div>
      {data === undefined ? (
        <ListSkeleton label="Memuat laporan..." rows={3} />
      ) : data.sekarang.jumlahTransaksi === 0 && data.sekarang.batchTotal === 0 && data.sekarang.uangMasuk === 0 && data.sekarang.biayaOperasional === 0 ? (
        <EmptyState icon={BarChart3}>Belum ada transaksi atau pembelian stok pada periode ini.</EmptyState>
      ) : (
        <LaporanBody judul={judul} sekarang={data.sekarang} sebelumnya={data.sebelumnya} />
      )}
    </main>
  )
}

function LaporanBody({ judul, sekarang, sebelumnya }: { judul: string; sekarang: LaporanRingkasan; sebelumnya: LaporanRingkasan }) {
  // A delta against zero or a loss is meaningless (and its sign inverts), so
  // it is only shown when the previous period made a positive laba.
  const labaDelta =
    sekarang.labaKotor !== null && sebelumnya.labaKotor !== null && sebelumnya.labaKotor > 0
      ? deltaPercent(sekarang.labaKotor, sebelumnya.labaKotor)
      : null
  const penjualanDelta = deltaPercent(sekarang.penjualan, sebelumnya.penjualan)
  const maxKategori = Math.max(1, ...sekarang.perKategori.map(k => k.penjualan))

  return (
    <>
      <section className={`card-in ${PANEL} flex flex-col gap-2 p-6 md:p-8`} style={stagger(0)}>
        <span className="text-sm font-medium text-ink-muted">Laba kotor {judul}</span>
        <div className="text-3xl font-bold leading-none text-ink md:text-[44px] md:leading-[1.05]">
          {sekarang.labaKotor === null ? <span aria-label="Belum diketahui">−</span> : <Money value={sekarang.labaKotor} />}
        </div>
        {labaDelta !== null && (
          <span className="text-xs text-ink-muted"><DeltaBadge value={labaDelta} /> <span className="ml-1">dari periode sebelumnya</span></span>
        )}
        <p className="text-xs leading-5 text-ink-muted">
          {labaNote(sekarang)}
          {sekarang.biayaOperasional === 0 && (
            <> Belum ada biaya operasional tercatat, jadi ini belum laba bersih. <Link to="/biaya" className="font-semibold text-primary-ink underline-offset-2 hover:underline">Catat biaya</Link></>
          )}
        </p>
      </section>

      {sekarang.biayaOperasional > 0 && (
        <section className={`card-in ${PANEL} flex flex-col gap-2 p-6`} style={stagger(1)}>
          <span className="text-sm font-medium text-ink-muted">Laba bersih {judul}</span>
          <div className="text-2xl font-bold leading-none text-ink md:text-4xl">
            {sekarang.labaBersih === null ? <span aria-label="Belum diketahui">−</span> : <Money value={sekarang.labaBersih} />}
          </div>
          <p className="text-xs leading-5 text-ink-muted">Laba kotor dikurangi biaya operasional {judul}.</p>
        </section>
      )}

      <ul aria-label="Ringkasan angka" className={`card-in ${PANEL} divide-y divide-separator`} style={stagger(1)}>
        <li className="flex items-start justify-between gap-4 p-5">
          <div>
            <span className="text-sm font-medium text-ink-muted">Penjualan</span>
            <div className="mt-1 text-xs text-ink-muted">
              {sekarang.jumlahTransaksi} transaksi{' '}
              {penjualanDelta !== null && <DeltaBadge value={penjualanDelta} />}
            </div>
          </div>
          <span className="text-xl font-semibold text-ink"><Money value={sekarang.penjualan} /></span>
        </li>
        <li className="flex items-start justify-between gap-4 p-5">
          <div>
            <span className="text-sm font-medium text-ink-muted">Belanja stok</span>
            <div className="mt-1 text-xs text-ink-muted">{sekarang.batchTotal} pembelian</div>
          </div>
          <span className="text-xl font-semibold text-ink"><Money value={sekarang.belanjaStok} /></span>
        </li>
        <li className="flex items-start justify-between gap-4 p-5">
          <div>
            <span className="text-sm font-medium text-ink-muted">Biaya operasional</span>
            <div className="mt-1 text-xs text-ink-muted">
              <Link to="/biaya" className="font-semibold text-primary-ink underline-offset-2 hover:underline">Kelola biaya</Link>
            </div>
          </div>
          <span className="text-xl font-semibold text-ink"><Money value={sekarang.biayaOperasional} /></span>
        </li>
        <li className="flex items-start justify-between gap-4 p-5">
          <div>
            <span className="text-sm font-medium text-ink-muted">Arus kas</span>
            <div className="mt-1 text-xs text-ink-muted">
              {sekarang.arusKasLengkap
                ? `Uang masuk ${formatRupiah(rupiah(sekarang.uangMasuk))} dikurangi belanja stok${sekarang.biayaOperasional > 0 ? ' dan biaya operasional' : ''}.`
                : `${sekarang.batchTanpaHarga} pembelian belum punya harga beli, jadi belanja stok sebenarnya lebih besar.`}
            </div>
          </div>
          <span className="text-xl font-semibold text-ink"><Money value={sekarang.arusKas} /></span>
        </li>
      </ul>

      {sekarang.uangMasukPerMetode.length > 1 && (
        <section aria-labelledby="lap-metode" className="flex flex-col gap-3">
          <div id="lap-metode"><SectionLabel>Uang masuk per metode</SectionLabel></div>
          <ul aria-label="Uang masuk per metode" className={`card-in ${PANEL} divide-y divide-separator`}>
            {sekarang.uangMasukPerMetode.map(m => (
              <li key={m.metode} className="flex items-baseline justify-between gap-4 p-5">
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{LABEL_METODE[m.metode]}</span>
                <span className="text-sm font-semibold text-ink"><Money value={m.jumlah} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sekarang.biayaPerKategori.length > 0 && (
        <section aria-labelledby="lap-biaya" className="flex flex-col gap-3">
          <div id="lap-biaya"><SectionLabel>Biaya per kategori</SectionLabel></div>
          <ul aria-label="Biaya per kategori" className={`card-in ${PANEL} divide-y divide-separator`}>
            {sekarang.biayaPerKategori.map(b => (
              <li key={b.kategori} className="flex items-baseline justify-between gap-4 p-5">
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{labelBiaya(b.kategori)}</span>
                <span className="text-sm font-semibold text-ink"><Money value={b.jumlah} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sekarang.perKategori.length > 0 && (
        <section aria-labelledby="lap-kategori" className="flex flex-col gap-3">
          <div id="lap-kategori"><SectionLabel>Margin per kategori</SectionLabel></div>
          <ul aria-label="Margin per kategori" className={`card-in ${PANEL} divide-y divide-separator`} style={stagger(2)}>
            {sekarang.perKategori.map(k => (
              <li key={k.kategori} className="flex flex-col gap-2 p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">{k.kategori}</span>
                  <span className="text-sm font-semibold text-ink"><Money value={k.penjualan} /></span>
                </div>
                <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-fill">
                  <div className="h-full rounded-pill bg-primary" style={{ width: `${Math.round((k.penjualan / maxKategori) * 100)}%` }} />
                </div>
                <span className="text-xs text-ink-muted">
                  {k.margin === null ? 'margin −, harga beli belum tercatat' : `margin ${qtyFormat.format(k.margin)}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sekarang.terlaris.length > 0 && (
        <section aria-labelledby="lap-terlaris" className="flex flex-col gap-3">
          <div id="lap-terlaris"><SectionLabel>Barang terlaris</SectionLabel></div>
          <ul aria-label="Barang terlaris" className={`card-in ${PANEL} divide-y divide-separator`} style={stagger(3)}>
            {sekarang.terlaris.map(t => (
              <li key={t.itemId} className="flex items-baseline justify-between gap-4 p-5">
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{t.nama}</span>
                  <span className="text-xs text-ink-muted">{qtyFormat.format(t.qty / 1000)} {t.unit}</span>
                </div>
                <span className="text-sm font-semibold text-ink"><Money value={t.penjualan} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sekarang.perHari.length > 1 && (
        <section aria-labelledby="lap-harian" className={`card-in ${PANEL} flex flex-col gap-3 p-5`} style={stagger(4)}>
          <div id="lap-harian"><SectionLabel>Penjualan harian</SectionLabel></div>
          <Sparkline values={sekarang.perHari.map(h => h.penjualan)} width={320} height={64} />
        </section>
      )}
    </>
  )
}
