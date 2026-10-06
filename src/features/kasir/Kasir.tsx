import { useState } from 'react'
import { SearchScanField } from './SearchScanField'
import { ProductGrid } from './ProductGrid'
import { CartPanel } from './CartPanel'
import { CartBar } from './CartBar'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { useIsCompact } from '../shared/useIsCompact'
import { useCart } from './useCart'
import { useKatalog, type UkuranRow } from '../shared/useKatalog'
import { filterBarangRows, purchasableBarangRows } from './filterBarangRows'
import { BarangPicker } from '../shared/BarangPicker'
import { UkuranSheet, type UkuranSheetValues } from '../kamus/UkuranSheet'
import { db } from '../../data/db'
import { recordUkuran } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'
import { toBase } from '../../domain/quantity'
import { legacyRemainder, pickDefaultBatch } from '../../domain/batchPick'
import { PageHeader } from '../../ui/PageHeader'

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
  const compact = useIsCompact()
  const [cartOpen, setCartOpen] = useState(false)

  const trimmedSearch = searchValue.trim()
  // Checked against the SAME sellable rows ProductGrid renders, not every
  // katalog row: a barang with no sellable ukuran (e.g. one quick-created
  // and then abandoned before any ukuran was added) can never appear in the
  // grid, so it must not count as a match either - otherwise its name would
  // suppress "Tambah barang baru" forever, with nothing shown to add.
  const searchHasNoMatches =
    rows !== undefined && trimmedSearch !== '' &&
    filterBarangRows(purchasableBarangRows(rows), trimmedSearch, null).length === 0

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
    <main className={`mx-auto flex w-full max-w-workspace flex-col gap-5 p-4 md:p-8 ${compact && cart.lines.length > 0 ? 'pb-28' : ''}`}>
      <PageHeader title="Kasir" subtitle="Transaksi baru" />

      <section aria-label="Pencarian barang" className="rounded-card bg-surface p-4 shadow-card">
        <SearchScanField key={searchFieldKey} value={searchValue} onChange={setSearchValue} onScan={handleScan} autoFocus />
      </section>

      {inlineCreate && (
        <section className="card-in rounded-card bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-ink">Tambah barang baru</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setInlineCreate(null); setInlineBarangId(null) }}
            >
              Tutup
            </Button>
          </div>
          {inlineCreate.source === 'barcode' && (
            <p className="mb-3 text-sm text-ink-muted">
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
        <div className="card-in flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card">
          <p className="text-sm text-ink-muted">
            Barang &quot;{trimmedSearch}&quot; tidak ditemukan.
          </p>
          <Button
            variant="primary"
            onClick={() => setInlineCreate({ source: 'nama', value: trimmedSearch })}
          >
            Tambah barang baru
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="lg:flex-[1.9_1_0%]">
          <ProductGrid searchQuery={searchValue} onAdd={handleAddToCart} />
        </div>
        {/* Wide screens: the cart is a sticky column that never grows taller
            than the window, so the line list scrolls inside it and the total
            and Simpan stay on screen. Phones: see the bar and sheet below. */}
        {!compact && (
          <div className="lg:sticky lg:top-4 lg:flex-[1_1_0%]">
            <CartPanel cart={cart} onSaveAndNew={handleSaveAndNew} />
          </div>
        )}
      </div>

      {compact && cart.lines.length > 0 && !cartOpen && (
        <CartBar count={cart.lines.length} total={cart.subtotal} onOpen={() => setCartOpen(true)} />
      )}
      {compact && (
        <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title="Keranjang">
          <CartPanel cart={cart} embedded onSaveAndNew={handleSaveAndNew} onDone={() => setCartOpen(false)} />
        </Sheet>
      )}
    </main>
  )
}
