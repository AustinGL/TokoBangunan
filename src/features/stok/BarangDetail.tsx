import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useKatalog, type UkuranRow } from '../shared/useKatalog'
import { useSuppliers } from '../shared/useSuppliers'
import { useRiwayatStok } from './useRiwayatStok'
import { TambahStokSheet } from './TambahStokSheet'
import { AturUkuranSheet } from './AturUkuranSheet'
import { KoreksiPembelianSheet } from './KoreksiPembelianSheet'
import { formatRupiah, rupiah } from '../../domain/money'
import { formatTanggal } from '../shared/formatTanggal'
import type { RiwayatBatchRow } from './riwayatStok'

const STATUS_LABEL: Record<string, string> = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' }
const STATUS_CLASS: Record<string, string> = {
  habis: 'bg-danger-bg text-danger', menipis: 'bg-warning-bg text-warning', aman: 'bg-success-bg text-success',
}

/** Sentinel for ?ukuran= meaning "every surviving ukuran" - never a real itemId (those are UUIDv7s). */
const ALL_UKURAN_PARAM = 'semua'

export function BarangDetail() {
  const { barangKey } = useParams<{ barangKey: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const katalog = useKatalog()
  const suppliers = useSuppliers()

  const barangRow = katalog?.find(r => r.barangId === barangKey)
  const survivingUkuran = useMemo(() => barangRow?.ukuran.filter(u => !u.diarsipkan) ?? [], [barangRow])

  const ukuranParam = searchParams.get('ukuran')
  const semuaUkuran = ukuranParam === ALL_UKURAN_PARAM
  // A stale deep link (an archived/removed/foreign id) falls back to the
  // first surviving ukuran rather than rendering nothing.
  const selectedUkuran = semuaUkuran
    ? undefined
    : (survivingUkuran.find(u => u.id === ukuranParam) ?? survivingUkuran[0])

  const selectUkuran = (itemId: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('ukuran', itemId)
    setSearchParams(next)
  }
  const selectSemuaUkuran = () => {
    const next = new URLSearchParams(searchParams)
    next.set('ukuran', ALL_UKURAN_PARAM)
    setSearchParams(next)
  }

  // Always queries every surviving ukuran, never just the selected one -
  // the query's own key (useRiwayatStok's joined itemIds) then stays
  // identical across a single-ukuran <-> "Semua ukuran" toggle, so
  // switching is a synchronous client-side filter below rather than a new
  // async query. useLiveQuery (dexie-react-hooks) keeps returning its
  // PREVIOUS result until a new query resolves rather than resetting to
  // undefined - querying per-selection would otherwise show the old
  // selection's stale rows for a beat after every toggle (confirmed by a
  // flaky "expected 3 got 2" row-count failure on Semua ukuran before this
  // was changed).
  const riwayatItems = useMemo(() => survivingUkuran.map(u => ({ id: u.id, baseUnit: u.ukuran })), [survivingUkuran])
  const allRiwayat = useRiwayatStok(riwayatItems)
  const riwayat = useMemo(() => {
    if (allRiwayat === undefined) return undefined
    if (semuaUkuran) return allRiwayat
    return selectedUkuran ? allRiwayat.filter(r => r.itemId === selectedUkuran.id) : []
  }, [allRiwayat, semuaUkuran, selectedUkuran])

  const [tambahStokOpen, setTambahStokOpen] = useState(false)
  const [aturUkuran, setAturUkuran] = useState<UkuranRow | null>(null)
  const [koreksiBatch, setKoreksiBatch] = useState<RiwayatBatchRow | null>(null)

  if (katalog === undefined) {
    return (
      <main className="flex flex-col gap-5 p-4 md:p-8">
        <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Memuat barang...
        </div>
      </main>
    )
  }

  if (!barangRow) {
    return (
      <main className="flex flex-col gap-5 p-4 md:p-8">
        <Link to="/stok" className="text-[13px] font-semibold text-ink-muted">‹ Stok</Link>
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Barang tidak ditemukan.
        </p>
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link to="/stok" className="text-[13px] font-semibold text-ink-muted">‹ Stok</Link>
          <h1 className="text-[17px] font-bold text-ink">
            {barangRow.nama}
            {barangRow.kategori && <span className="ml-2 text-[13px] font-normal text-ink-muted">· {barangRow.kategori}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* No per-barang deep-link exists in Kamus Barang yet - a plain
              link, same scope-decision precedent as plan 08's own explicit
              "tracked for its own follow-up" notes. */}
          <Link
            to="/kamus"
            className="min-h-tap rounded-field border border-[var(--btn-secondary-bd)] bg-[var(--btn-secondary-bg)] px-4 text-[14px] font-semibold text-[var(--btn-secondary-fg)]"
          >
            Ubah di Kamus
          </Link>
          <button
            type="button"
            onClick={() => setTambahStokOpen(true)}
            className="min-h-tap rounded-tile bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
          >
            + Tambah stok
          </button>
        </div>
      </div>

      <div role="group" aria-label="Ukuran" className="flex flex-wrap gap-3">
        {survivingUkuran.map(u => {
          const active = !semuaUkuran && selectedUkuran?.id === u.id
          return (
            <div key={u.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <button type="button" aria-pressed={active} onClick={() => selectUkuran(u.id)} className="flex flex-col gap-1 text-left">
                <span className="text-[13px] font-semibold text-ink-muted">{u.ukuran}</span>
                <span className="text-[22px] font-bold tabular-nums text-ink">Sisa {u.quantity}</span>
                <span className={`inline-flex w-fit items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[12px] font-semibold ${STATUS_CLASS[u.status]}`}>
                  {STATUS_LABEL[u.status]}
                </span>
                <span className="text-[13px] text-ink-muted">@ {formatRupiah(rupiah(u.hargaEceran))} · min {u.stokMinimum}</span>
              </button>
              <button
                type="button" onClick={() => setAturUkuran(u)}
                className="min-h-tap self-start text-[13px] font-semibold text-ink underline"
              >
                Atur
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-ink">
            Riwayat stok · {semuaUkuran ? 'Semua ukuran' : selectedUkuran?.ukuran ?? '-'}
          </h2>
          {!semuaUkuran && survivingUkuran.length > 1 && (
            <button type="button" onClick={selectSemuaUkuran} className="text-[13px] font-semibold text-ink underline">
              Semua ukuran
            </button>
          )}
        </div>

        {riwayat === undefined ? (
          <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
            Memuat riwayat...
          </div>
        ) : riwayat.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
            Belum ada riwayat pembelian untuk ukuran ini.
          </p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="p-2">Tgl beli</th>
                <th scope="col" className="p-2">Supplier</th>
                {semuaUkuran && <th scope="col" className="p-2">Ukuran</th>}
                <th scope="col" className="p-2">Beli</th>
                <th scope="col" className="p-2">H.beli</th>
                <th scope="col" className="p-2">H.jual</th>
                <th scope="col" className="p-2">Sisa</th>
                <th scope="col" className="p-2">Transaksi</th>
                <th scope="col" className="p-2" />
              </tr>
            </thead>
            <tbody>
              {riwayat.map(row => (
                <tr key={row.kind === 'batch' ? row.batchId : `legacy-${row.itemId}`} className="border-t border-border">
                  <td className="p-2 text-ink">{row.kind === 'batch' ? formatTanggal(row.tanggalBeli) : '—'}</td>
                  <td className="p-2 text-ink">{row.kind === 'batch' ? (row.supplierNama ?? '—') : 'Stok lama'}</td>
                  {semuaUkuran && <td className="p-2 text-ink">{row.ukuran}</td>}
                  <td className="p-2 text-ink">{row.kind === 'batch' ? row.diterima : '—'}</td>
                  <td className="p-2 text-ink">
                    {row.kind === 'batch' ? (row.hargaBeli !== undefined ? formatRupiah(rupiah(row.hargaBeli)) : '—') : '—'}
                  </td>
                  <td className="p-2 text-ink">{row.kind === 'batch' ? formatRupiah(rupiah(row.hargaJual)) : '—'}</td>
                  <td className="p-2 text-ink">{row.sisa}</td>
                  <td className="p-2 text-ink">
                    <Link to={row.kind === 'batch' ? `/transaksi?batch=${row.batchId}` : `/transaksi?item=${row.itemId}`} className="underline">
                      {row.transaksiCount} ›
                    </Link>
                  </td>
                  <td className="p-2">
                    {row.kind === 'batch' && (
                      <button
                        type="button" onClick={() => setKoreksiBatch(row)}
                        className="min-h-tap text-[13px] font-semibold text-ink underline"
                      >
                        ⋯ Koreksi pembelian
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {tambahStokOpen && (
        <TambahStokSheet
          open
          onClose={() => setTambahStokOpen(false)}
          initialBarangId={barangRow.virtual ? null : barangRow.barangId}
          initialItemId={barangRow.virtual ? null : (selectedUkuran?.id ?? null)}
          initialHargaJual={barangRow.virtual ? null : (selectedUkuran?.hargaEceran ?? null)}
        />
      )}
      {aturUkuran && <AturUkuranSheet open onClose={() => setAturUkuran(null)} item={aturUkuran} />}
      {koreksiBatch && suppliers && (
        <KoreksiPembelianSheet open onClose={() => setKoreksiBatch(null)} batch={koreksiBatch} suppliers={suppliers} />
      )}
    </main>
  )
}
