import { useState } from 'react'
import { SearchScanField } from './SearchScanField'
import { ProductGrid } from './ProductGrid'
import { CartPanel } from './CartPanel'
import { useCart } from './useCart'
import { useKatalog, type UkuranRow } from '../shared/useKatalog'
import { filterBarangRows } from './filterBarangRows'
import { BarangPicker } from '../shared/BarangPicker'
import { UkuranSheet, type UkuranSheetValues } from '../kamus/UkuranSheet'
import { db } from '../../data/db'
import { recordUkuran } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { toBase } from '../../domain/quantity'
import { legacyRemainder, pickDefaultBatch } from '../../domain/batchPick'

/**
 * Screen-assembly root for /kasir. E1's rework: adding an ukuran now
 * resolves its default purchase batch (or the legacy pool) with one
 * snapshot Dexie read at click-time - not a hook, since the ukuran being
 * added varies per click and React hooks cannot be called conditionally -
 * the same "read, then decide, then write" shape commands.ts's own
 * recordStockPurchase/correctBatch already use.
 *
 * Inline creation from an unknown scan or a typed name with no match no
 * longer uses the flat ItemForm (which always created a brand-new,
 * barang-less item): it reuses BarangPicker (pick an EXISTING barang, or
 * quick-create one) followed by UkuranSheet (always creating a fresh
 * ukuran under whichever barang was picked), so a genuine new size of an
 * already-known product is never filed as a duplicate barang.
 */

type InlineCreate = { source: 'barcode' | 'nama'; value: string }

export function Kasir() {
  const cart = useCart()
  const rows = useKatalog()
  const [searchValue, setSearchValue] = useState('')
  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null)
  const [inlineBarangId, setInlineBarangId] = useState<string | null>(null)
  const [searchFieldKey, setSearchFieldKey] = useState(0)

  const trimmedSearch = searchValue.trim()
  const searchHasNoMatches =
    rows !== undefined && trimmedSearch !== '' && filterBarangRows(rows, trimmedSearch, null).length === 0

  const resolveDefaultBatch = async (ukuran: UkuranRow) => {
    const [batches, stockRow] = await Promise.all([
      db.batchesProj.where('itemId').equals(ukuran.id).toArray(),
      db.stokProj.get(ukuran.id),
    ])
    const legacyAvailable = legacyRemainder(stockRow?.quantity ?? 0, batches, ukuran.id)
    const otherLines = cart.lines
      .filter(l => l.itemId === ukuran.id)
      .map(l => ({ itemId: l.itemId, batchId: l.batchId, qty: l.qty }))
    const addQty = toBase(1, { unit: ukuran.ukuran, factor: 1 })
    const pick = pickDefaultBatch(ukuran.id, addQty, legacyAvailable, batches, otherLines)
    const hargaNormal = pick.batchId
      ? (batches.find(b => b.batchId === pick.batchId)?.hargaJual ?? ukuran.hargaEceran)
      : ukuran.hargaEceran
    return { batchId: pick.batchId, hargaNormal }
  }

  const handleAddToCart = async (ukuran: UkuranRow, barangNama: string) => {
    const { batchId, hargaNormal } = await resolveDefaultBatch(ukuran)
    cart.addItem({ id: ukuran.id, nama: `${barangNama} · ${ukuran.ukuran}`, baseUnit: ukuran.ukuran }, batchId, hargaNormal)
    setSearchValue('')
  }

  const handleScan = (value: string) => {
    const match = rows
      ?.flatMap(r => r.ukuran.map(u => ({ barang: r, ukuran: u })))
      .find(({ ukuran }) => ukuran.barcode === value)
    if (match) {
      void handleAddToCart(match.ukuran, match.barang.nama)
      setInlineCreate(null)
    } else {
      setInlineCreate({ source: 'barcode', value })
      setInlineBarangId(null)
    }
  }

  const handleUkuranCreated = async (values: UkuranSheetValues) => {
    if (!inlineBarangId) return
    const id = await recordUkuran(
      { barangId: inlineBarangId, ukuran: values.ukuran, hargaEceran: values.hargaEceran, stokMinimum: values.stokMinimum, barcode: values.barcode ?? undefined },
      { clock: systemClock, deviceId: getDeviceId() },
    )
    const barangNama = rows?.find(r => r.barangId === inlineBarangId)?.nama ?? ''
    // A never-purchased ukuran has no batch yet: the legacy pool, priced at
    // the default just typed into UkuranSheet.
    cart.addItem({ id, nama: `${barangNama} · ${values.ukuran}`, baseUnit: values.ukuran }, undefined, values.hargaEceran)
    setInlineCreate(null)
    setInlineBarangId(null)
    setSearchValue('')
  }

  const handleSaveAndNew = () => {
    setSearchValue('')
    setSearchFieldKey(key => key + 1)
  }

  const inlineBarangNama = rows?.find(r => r.barangId === inlineBarangId)?.nama ?? ''

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <h1 className="text-[17px] font-bold text-ink">Kasir</h1>

      <SearchScanField key={searchFieldKey} value={searchValue} onChange={setSearchValue} onScan={handleScan} autoFocus />

      {inlineCreate && (
        <section className="rounded-card border border-border bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-[14px] font-bold text-ink">Tambah barang baru</h2>
            <button
              type="button"
              onClick={() => { setInlineCreate(null); setInlineBarangId(null) }}
              className="min-h-tap rounded-tile px-3 text-[13px] font-medium text-ink-muted"
            >
              Tutup
            </button>
          </div>
          {inlineCreate.source === 'barcode' && (
            <p className="mb-3 text-[13px] text-ink-muted">
              Kode &quot;{inlineCreate.value}&quot; belum dikenal. Pilih barang yang sudah ada atau buat baru, lalu isi ukurannya.
            </p>
          )}
          <BarangPicker
            value={inlineBarangId}
            onChange={setInlineBarangId}
            initialNama={inlineCreate.source === 'nama' ? inlineCreate.value : undefined}
          />
          {inlineBarangId && (
            <div className="mt-4">
              <UkuranSheet
                open
                onClose={() => setInlineBarangId(null)}
                onSubmit={handleUkuranCreated}
                barangOptions={[{ barangId: inlineBarangId, nama: inlineBarangNama }]}
                currentBarangId={inlineBarangId}
                initialBarcode={inlineCreate.source === 'barcode' ? inlineCreate.value : undefined}
              />
            </div>
          )}
        </section>
      )}

      {!inlineCreate && searchHasNoMatches && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-dashed border-border-input bg-surface p-3">
          <p className="text-[14px] text-ink-muted">
            Barang &quot;{trimmedSearch}&quot; tidak ditemukan.
          </p>
          <button
            type="button"
            onClick={() => setInlineCreate({ source: 'nama', value: trimmedSearch })}
            className="min-h-tap rounded-tile bg-[var(--btn-primary-bg)] px-4 text-[13px] font-semibold text-[var(--btn-primary-fg)]"
          >
            Tambah barang baru
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <div className="lg:flex-[1.9_1_0%]">
          <ProductGrid searchQuery={searchValue} onAdd={handleAddToCart} />
        </div>
        <div className="lg:flex-[1_1_0%]">
          <CartPanel cart={cart} onSaveAndNew={handleSaveAndNew} />
        </div>
      </div>
    </main>
  )
}
