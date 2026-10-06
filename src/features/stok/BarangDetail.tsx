import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useKatalog, type UkuranRow } from '../shared/useKatalog'
import { useSuppliers } from '../shared/useSuppliers'
import { useRiwayatStok } from './useRiwayatStok'
import { TambahStokSheet } from './TambahStokSheet'
import { AturUkuranSheet } from './AturUkuranSheet'
import { KoreksiPembelianSheet } from './KoreksiPembelianSheet'
import { formatRupiah, rupiah } from '../../domain/money'
import { formatTanggal } from '../shared/formatTanggal'
import type { RiwayatBatchRow } from './riwayatStok'
import { StatusPill } from '../../ui/StatusPill'
import { Button, ButtonLink } from '../../ui/Button'
import { Package } from 'lucide-react'
import { IconTile } from '../../ui/IconTile'
import { STOK_TONE, STOK_LABEL } from '../shared/stokTone'


/** Sentinel for ?ukuran= meaning "every surviving ukuran" - never a real itemId (those are UUIDv7s). */
/** A Riwayat cell: a plain table cell on wide screens; on a phone a label-above-value block. */
const CELL = 'p-2 text-ink max-md:flex max-md:flex-col max-md:p-0 max-md:before:text-xs max-md:before:text-ink-muted max-md:before:content-[attr(data-label)]'

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
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
        <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6 text-sm text-ink-muted">
          Memuat barang...
        </div>
      </main>
    )
  }

  if (!barangRow) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
        <ButtonLink to="/stok" variant="link" className="self-start">‹ Stok</ButtonLink>
        <p className="rounded-card border border-border bg-surface p-6 text-sm text-ink-muted">
          Barang tidak ditemukan.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconTile icon={Package} />
          <div className="flex min-w-0 flex-col gap-1">
            <ButtonLink to="/stok" variant="link" className="-ml-1 self-start">‹ Stok</ButtonLink>
            <h1 className="break-words text-lg font-bold text-ink">
              {barangRow.nama}
              {barangRow.kategori && <span className="ml-2 text-sm font-normal text-ink-muted">· {barangRow.kategori}</span>}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* No per-barang deep-link exists in Kamus Barang yet - a plain
              link, same scope-decision precedent as plan 08's own explicit
              "tracked for its own follow-up" notes. */}
          <ButtonLink to="/kamus" variant="secondary">Ubah di Kamus</ButtonLink>
          <Button variant="primary" onClick={() => setTambahStokOpen(true)}>+ Tambah stok</Button>
        </div>
      </div>

      <div role="group" aria-label="Ukuran" className="flex flex-wrap gap-3">
        {survivingUkuran.map(u => {
          const active = !semuaUkuran && selectedUkuran?.id === u.id
          return (
            <div key={u.id} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
              <button type="button" aria-pressed={active} onClick={() => selectUkuran(u.id)} className="flex min-h-control flex-col gap-1 text-left">
                <span className="text-sm font-semibold text-ink-muted">{u.ukuran}</span>
                <span className="text-xl font-bold tabular-nums text-ink">Sisa {u.quantity}</span>
                <span className="w-fit"><StatusPill tone={STOK_TONE[u.status]}>{STOK_LABEL[u.status]}</StatusPill></span>
                <span className="text-sm text-ink-muted">@ {formatRupiah(rupiah(u.hargaEceran))} · min {u.stokMinimum}</span>
              </button>
              <Button variant="link" className="self-start" onClick={() => setAturUkuran(u)}>Atur ukuran</Button>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">
            Riwayat stok · {semuaUkuran ? 'Semua ukuran' : selectedUkuran?.ukuran ?? '-'}
          </h2>
          {!semuaUkuran && survivingUkuran.length > 1 && (
            <Button variant="link" onClick={selectSemuaUkuran}>Semua ukuran</Button>
          )}
        </div>

        {riwayat === undefined ? (
          <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6 text-sm text-ink-muted">
            Memuat riwayat...
          </div>
        ) : riwayat.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-6 text-sm text-ink-muted">
            Belum ada riwayat pembelian untuk ukuran ini.
          </p>
        ) : (
          // On a phone each batch becomes a small card: label above value, two
          // columns. Same table, same cells (so the text is not duplicated);
          // explicit roles keep it a table for assistive tech even though the
          // CSS stops it looking like one.
          <table role="table" className="w-full text-left text-sm max-md:block">
            <thead role="rowgroup" className="sticky top-0 z-sticky bg-surface max-md:sr-only">
              <tr role="row" className="text-ink-muted">
                <th scope="col" className="p-2">Tanggal beli</th>
                <th scope="col" className="p-2">Supplier</th>
                {semuaUkuran && <th scope="col" className="p-2">Ukuran</th>}
                <th scope="col" className="p-2">Jumlah beli</th>
                <th scope="col" className="p-2">Harga beli</th>
                <th scope="col" className="p-2">Harga jual</th>
                <th scope="col" className="p-2">Sisa</th>
                <th scope="col" className="p-2">Transaksi</th>
                <th scope="col" className="p-2"><span className="sr-only">Aksi</span></th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="max-md:flex max-md:flex-col max-md:gap-3">
              {riwayat.map(row => (
                <tr
                  role="row"
                  key={row.kind === 'batch' ? row.batchId : `legacy-${row.itemId}`}
                  className="border-t border-border max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-2 max-md:rounded-card max-md:border max-md:bg-surface max-md:p-3"
                >
                  <td role="cell" data-label="Tanggal beli" className={CELL}>{row.kind === 'batch' ? formatTanggal(row.tanggalBeli) : '—'}</td>
                  <td role="cell" data-label="Supplier" className={CELL}>{row.kind === 'batch' ? (row.supplierNama ?? '—') : 'Stok lama'}</td>
                  {semuaUkuran && <td role="cell" data-label="Ukuran" className={CELL}>{row.ukuran}</td>}
                  <td role="cell" data-label="Jumlah beli" className={CELL}>{row.kind === 'batch' ? row.diterima : '—'}</td>
                  <td role="cell" data-label="Harga beli" className={CELL}>
                    {row.kind === 'batch' ? (row.hargaBeli !== undefined ? formatRupiah(rupiah(row.hargaBeli)) : '—') : '—'}
                  </td>
                  <td role="cell" data-label="Harga jual" className={CELL}>{row.kind === 'batch' ? formatRupiah(rupiah(row.hargaJual)) : '—'}</td>
                  <td role="cell" data-label="Sisa" className={CELL}>{row.sisa}</td>
                  <td role="cell" data-label="Transaksi" className={CELL}>
                    <ButtonLink
                      to={row.kind === 'batch' ? `/transaksi?batch=${row.batchId}` : `/transaksi?item=${row.itemId}`}
                      variant="link"
                      className="self-start"
                    >
                      {row.transaksiCount} ›
                    </ButtonLink>
                  </td>
                  <td role="cell" className="p-2 max-md:col-span-2">
                    {row.kind === 'batch' && (
                      <Button variant="link" onClick={() => setKoreksiBatch(row)}>⋯ Koreksi pembelian</Button>
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
          initialBarangId={barangRow.virtual || barangRow.diarsipkan ? null : barangRow.barangId}
          initialItemId={barangRow.virtual || barangRow.diarsipkan ? null : (selectedUkuran?.id ?? null)}
          initialHargaJual={barangRow.virtual || barangRow.diarsipkan ? null : (selectedUkuran?.hargaEceran ?? null)}
        />
      )}
      {aturUkuran && <AturUkuranSheet open onClose={() => setAturUkuran(null)} item={aturUkuran} />}
      {koreksiBatch && suppliers && (
        <KoreksiPembelianSheet open onClose={() => setKoreksiBatch(null)} batch={koreksiBatch} suppliers={suppliers} />
      )}
    </main>
  )
}
