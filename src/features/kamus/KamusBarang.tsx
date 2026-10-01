import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Package, BookOpen, SearchX } from 'lucide-react'
import { useKatalog, type BarangRow } from '../shared/useKatalog'
import { BarangSheet, type BarangSheetValues } from './BarangSheet'
import { UkuranSheet, type UkuranSheetValues } from './UkuranSheet'
import { recordBarang, updateBarang, recordUkuran, updateUkuran } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { PageHeader } from '../../ui/PageHeader'
import { SearchField } from '../../ui/SearchField'
import { Select } from '../../ui/Select'
import { IconTile } from '../../ui/IconTile'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { EmptyState } from '../../ui/EmptyState'
import { ListSkeleton } from '../../ui/ListSkeleton'
import { formatRupiah, rupiah } from '../../domain/money'
import { StatusPill } from '../../ui/StatusPill'
import { STOK_TONE, STOK_LABEL } from '../shared/stokTone'
import { useKategori } from '../shared/useKategori'


function ctx() {
  return { clock: systemClock, deviceId: getDeviceId() }
}

export function KamusBarang() {
  const rows = useKatalog()
  const kategoriEntries = useKategori()
  const [search, setSearch] = useState('')
  const [kategori, setKategori] = useState('semua')
  const [showArsip, setShowArsip] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [barangSheet, setBarangSheet] = useState<{ mode: 'create' } | { mode: 'edit'; row: BarangRow } | null>(null)
  const [ukuranSheet, setUkuranSheet] = useState<{ barangId: string; row?: BarangRow['ukuran'][number] } | null>(null)

  const activeEntries = useMemo(() => (kategoriEntries ?? []).filter(entry => !entry.diarsipkan), [kategoriEntries])
  // The chosen kategori can vanish (archived or renamed away): fall back to
  // "semua" instead of filtering by something no control can clear any more.
  const activeKategori = activeEntries.some(entry => entry.id === kategori) ? kategori : 'semua'

  const visibleRows = useMemo(() => {
    if (!rows) return []
    const query = search.trim().toLowerCase()
    return rows.filter(row => {
      if (!showArsip && row.diarsipkan) return false
      if (query && !row.nama.toLowerCase().includes(query)) return false
      if (activeKategori !== 'semua' && row.kategoriId !== activeKategori) return false
      return true
    })
  }, [rows, search, activeKategori, showArsip])

  const totals = useMemo(() => {
    const active = (rows ?? []).filter(r => !r.diarsipkan)
    return { barang: active.length, ukuran: active.reduce((n, r) => n + r.ukuran.filter(u => !u.diarsipkan).length, 0) }
  }, [rows])

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
      await updateBarang({ id: barangSheet.row.barangId, nama: values.nama, kategoriId: values.kategoriId, diarsipkan: values.diarsipkan }, ctx())
    } else {
      const id = await recordBarang({ nama: values.nama, kategoriId: values.kategoriId ?? undefined }, ctx())
      // A barang with no ukuran cannot be sold or stocked, so the next thing
      // the owner needs is its first ukuran: open the row and that sheet
      // straight away instead of leaving them a "0 ukuran" line to find.
      setBarangSheet(null)
      setExpanded(id)
      setUkuranSheet({ barangId: id })
      return
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
      <PageHeader
        title="Kamus Barang"
        subtitle={rows !== undefined ? `${totals.barang} barang, ${totals.ukuran} ukuran` : undefined}
        action={
          <Button variant="primary" onClick={() => setBarangSheet({ mode: 'create' })}>
            + Barang baru
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <SearchField id="kamus-search" label="Cari barang" value={search} onChange={setSearch} placeholder="Cari nama barang" />
          </div>
          {activeEntries.length > 0 && (
            <Select
              variant="pill" id="kamus-kategori" label="Kategori" neutralValue="semua"
              options={[{ value: 'semua', label: 'Semua kategori' }, ...activeEntries.map(entry => ({ value: entry.id, label: entry.nama }))]}
              value={activeKategori} onChange={setKategori}
            />
          )}
        </div>
        <label className="flex h-control w-fit cursor-pointer items-center gap-2 rounded-pill border border-border-input bg-surface px-4 text-[13px] font-semibold text-ink">
          <input type="checkbox" checked={showArsip} onChange={e => setShowArsip(e.target.checked)} className="h-5 w-5 accent-primary" />
          Tampilkan arsip
        </label>
      </div>

      {rows === undefined ? (
        <ListSkeleton label="Memuat daftar barang..." />
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen}>Belum ada barang. Mulai tambahkan barang.</EmptyState>
      ) : visibleRows.length === 0 ? (
        <EmptyState icon={SearchX}>Tidak ada barang yang cocok dengan pencarian atau filter.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleRows.map(row => {
            const isOpen = expanded === row.barangId
            const visibleUkuran = row.ukuran.filter(u => showArsip || !u.diarsipkan)
            return (
              <li key={row.barangId} className="rounded-card border border-border bg-surface shadow-card">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.barangId)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <IconTile icon={Package} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold text-ink">{row.nama}</span>
                    {row.kategori && <span className="truncate text-[13px] text-ink-muted">{row.kategori}</span>}
                  </span>
                  <span className="shrink-0 rounded-pill bg-neutral-bg px-3 py-1 text-[12px] font-medium text-neutral">
                    {row.ukuran.length} ukuran
                  </span>
                  <Icon icon={isOpen ? ChevronDown : ChevronRight} size="button" className="shrink-0" />
                </button>

                {isOpen && (
                  <div data-testid={`barang-panel-${row.barangId}`} className="flex flex-col gap-3 border-t border-border p-4">
                    {row.virtual ? (
                      <p className="text-[13px] text-ink-muted">
                        Barang lama, belum masuk Kamus Barang. Pindahkan ukurannya ke barang lain untuk mengelolanya di sini.
                      </p>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <Button variant="secondary" size="sm" onClick={() => setBarangSheet({ mode: 'edit', row })}>
                          Ubah barang
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setUkuranSheet({ barangId: row.barangId })}>
                          + Tambah ukuran
                        </Button>
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
                            <StatusPill tone={STOK_TONE[u.status]}>{STOK_LABEL[u.status]}</StatusPill>
                            <Button variant="ghost" size="sm" onClick={() => setUkuranSheet({ barangId: row.barangId, row: u })}>
                              Ubah
                            </Button>
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
          initialValues={barangSheet.mode === 'edit' ? { nama: barangSheet.row.nama, kategoriId: barangSheet.row.kategoriId, diarsipkan: barangSheet.row.diarsipkan } : undefined}
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
