import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useKatalog, type BarangRow } from '../shared/useKatalog'
import { BarangSheet, type BarangSheetValues } from './BarangSheet'
import { UkuranSheet, type UkuranSheetValues } from './UkuranSheet'
import { recordBarang, updateBarang, recordUkuran, updateUkuran } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { CategoryPills } from '../../ui/CategoryPills'
import { formatRupiah, rupiah } from '../../domain/money'

const STATUS_CLASS: Record<string, string> = {
  habis: 'bg-danger-bg text-danger',
  menipis: 'bg-warning-bg text-warning',
  aman: 'bg-success-bg text-success',
}
const STATUS_LABEL: Record<string, string> = { habis: 'Habis', menipis: 'Menipis', aman: 'Aman' }

function ctx() {
  return { clock: systemClock, deviceId: getDeviceId() }
}

export function KamusBarang() {
  const rows = useKatalog()
  const [search, setSearch] = useState('')
  const [kategori, setKategori] = useState('semua')
  const [showArsip, setShowArsip] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [barangSheet, setBarangSheet] = useState<{ mode: 'create' } | { mode: 'edit'; row: BarangRow } | null>(null)
  const [ukuranSheet, setUkuranSheet] = useState<{ barangId: string; row?: BarangRow['ukuran'][number] } | null>(null)

  const categories = useMemo(() => {
    if (!rows) return []
    const distinct = new Set(rows.map(r => r.kategori).filter((k): k is string => Boolean(k)))
    return Array.from(distinct).sort()
  }, [rows])

  const visibleRows = useMemo(() => {
    if (!rows) return []
    const query = search.trim().toLowerCase()
    return rows.filter(row => {
      if (!showArsip && row.diarsipkan) return false
      if (query && !row.nama.toLowerCase().includes(query)) return false
      if (kategori !== 'semua' && row.kategori !== kategori) return false
      return true
    })
  }, [rows, search, kategori, showArsip])

  const barangOptions = useMemo(
    // A virtual barang (a legacy item with no real BarangUpserted record)
    // is never a valid move target: its barangId cannot be looked up in
    // barangProj, so writing it to another ukuran's barangId would create
    // a permanent dangling reference in the append-only log.
    () => (rows ?? []).filter(r => !r.diarsipkan && !r.virtual).map(r => ({ barangId: r.barangId, nama: r.nama })),
    [rows],
  )

  const handleBarangSubmit = async (values: BarangSheetValues) => {
    if (barangSheet?.mode === 'edit') {
      // updateBarang's own null-means-clear convention: pass through.
      await updateBarang({ id: barangSheet.row.barangId, ...values }, ctx())
    } else {
      // recordBarang has no existing row to preserve; null and undefined mean the same thing here.
      await recordBarang({ nama: values.nama, kategori: values.kategori ?? undefined }, ctx())
    }
    setBarangSheet(null)
  }

  const handleUkuranSubmit = async (values: UkuranSheetValues) => {
    if (!ukuranSheet) return
    if (ukuranSheet.row) {
      // updateUkuran's own null-means-clear convention (for barcode): pass through.
      await updateUkuran({ id: ukuranSheet.row.id, ...values }, ctx())
    } else {
      // recordUkuran has no existing row to preserve; null and undefined mean the same thing here.
      await recordUkuran({
        barangId: ukuranSheet.barangId, ukuran: values.ukuran, hargaEceran: values.hargaEceran,
        stokMinimum: values.stokMinimum, barcode: values.barcode ?? undefined,
      }, ctx())
    }
    setUkuranSheet(null)
  }

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[17px] font-bold text-ink">Kamus Barang</h1>
        <button
          type="button"
          onClick={() => setBarangSheet({ mode: 'create' })}
          className="min-h-tap rounded-tile bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
        >
          + Barang baru
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama barang"
          aria-label="Cari barang"
          className="h-[var(--field-h)] w-full rounded-field border border-[var(--field-bd)] bg-[var(--field-bg)] px-3 text-[14px] text-ink"
        />
        <CategoryPills
          name="kamus-kategori" aria-label="Filter kategori"
          options={[{ value: 'semua', label: 'Semua' }, ...categories.map(k => ({ value: k, label: k }))]}
          value={kategori} onChange={setKategori}
        />
        <label className="flex min-h-tap items-center gap-2 text-[14px] text-ink">
          <input type="checkbox" checked={showArsip} onChange={e => setShowArsip(e.target.checked)} className="h-5 w-5" />
          Tampilkan arsip
        </label>
      </div>

      {rows === undefined ? (
        <div aria-busy="true" role="status" className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Memuat daftar barang...
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Belum ada barang. Mulai tambahkan barang.
        </p>
      ) : visibleRows.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-[14px] text-ink-muted">
          Tidak ada barang yang cocok dengan pencarian atau filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleRows.map(row => {
            const isOpen = expanded === row.barangId
            const visibleUkuran = row.ukuran.filter(u => showArsip || !u.diarsipkan)
            return (
              <li key={row.barangId} className="rounded-card border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.barangId)}
                  aria-expanded={isOpen}
                  className="flex min-h-tap w-full items-center justify-between gap-4 p-4 text-left"
                >
                  <span className="flex items-center gap-2">
                    {isOpen ? <ChevronDown aria-hidden="true" size={18} /> : <ChevronRight aria-hidden="true" size={18} />}
                    <span className="text-[14px] font-semibold text-ink">{row.nama}</span>
                    {row.kategori && <span className="text-[13px] text-ink-muted">· {row.kategori}</span>}
                  </span>
                  <span className="text-[13px] text-ink-muted">{row.ukuran.length} ukuran</span>
                </button>

                {isOpen && (
                  <div data-testid={`barang-panel-${row.barangId}`} className="flex flex-col gap-3 border-t border-border p-4">
                    {row.virtual ? (
                      <p className="text-[13px] text-ink-muted">
                        Barang lama, belum masuk Kamus Barang. Pindahkan ukurannya ke barang lain untuk mengelolanya di sini.
                      </p>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => setBarangSheet({ mode: 'edit', row })}
                          className="min-h-tap rounded-tile px-3 text-[13px] font-medium text-ink-muted"
                        >
                          Ubah barang
                        </button>
                        <button
                          type="button"
                          onClick={() => setUkuranSheet({ barangId: row.barangId })}
                          className="min-h-tap rounded-tile bg-[var(--btn-secondary-bg)] border border-[var(--btn-secondary-bd)] px-3 text-[13px] font-semibold text-[var(--btn-secondary-fg)]"
                        >
                          + Tambah ukuran
                        </button>
                      </div>
                    )}

                    {visibleUkuran.length === 0 ? (
                      <p className="text-[13px] text-ink-muted">Belum ada ukuran.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {visibleUkuran.map(u => (
                          <li key={u.id} className="flex items-center justify-between gap-4 rounded-tile border border-border p-3">
                            <div className="flex flex-col">
                              <span className="text-[14px] text-ink">{u.ukuran}</span>
                              <span className="text-[12px] text-ink-muted">
                                {u.quantity} {u.ukuran} · {formatRupiah(rupiah(u.hargaEceran))}
                              </span>
                            </div>
                            <span className={`inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[12px] font-semibold ${STATUS_CLASS[u.status]}`}>
                              {STATUS_LABEL[u.status]}
                            </span>
                            <button
                              type="button"
                              onClick={() => setUkuranSheet({ barangId: row.barangId, row: u })}
                              className="min-h-tap rounded-tile px-3 text-[13px] font-medium text-ink-muted"
                            >
                              Ubah
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {barangSheet && (
        <BarangSheet
          open onClose={() => setBarangSheet(null)} onSubmit={handleBarangSubmit}
          initialValues={barangSheet.mode === 'edit' ? { nama: barangSheet.row.nama, kategori: barangSheet.row.kategori, diarsipkan: barangSheet.row.diarsipkan } : undefined}
        />
      )}

      {ukuranSheet && (
        <UkuranSheet
          open onClose={() => setUkuranSheet(null)} onSubmit={handleUkuranSubmit}
          barangOptions={barangOptions} currentBarangId={ukuranSheet.barangId}
          initialValues={ukuranSheet.row ? {
            ukuran: ukuranSheet.row.ukuran, hargaEceran: ukuranSheet.row.hargaEceran,
            stokMinimum: ukuranSheet.row.stokMinimum, barcode: ukuranSheet.row.barcode, diarsipkan: ukuranSheet.row.diarsipkan,
          } : undefined}
        />
      )}
    </main>
  )
}
