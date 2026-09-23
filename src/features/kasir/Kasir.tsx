import { useState } from 'react'
import { SearchScanField } from './SearchScanField'
import { ProductGrid } from './ProductGrid'
import { CartPanel } from './CartPanel'
import { useCart } from './useCart'
import { useProductCatalog, filterProductRows, type ProductRow } from './useProductCatalog'
import { ItemForm, type ItemFormValues } from '../stok/ItemForm'
import { recordItem } from '../../data/commands'
import { getDeviceId } from '../../data/deviceId'
import { systemClock } from '../../domain/clock'

/**
 * Screen-assembly root for /kasir, the same role ItemList.tsx plays for
 * /stok (not individually named in the plan's file-structure listing, but
 * something has to compose Task 6a's pieces into one screen).
 *
 * MASTER.md section 7, verbatim: "Main split: left flex: 1.9 1 0 (charts and
 * tables), right flex: 1 1 0 (side panels), gap --space-5, align-items:
 * stretch. On the POS screen the right panel is a full-height card." Below
 * 1024px the right panel drops below the main column, the project's usual
 * responsive breakpoint (no prior two-column split exists elsewhere in this
 * codebase to match against; lg: is Tailwind's own 1024px breakpoint, chosen
 * to line up with that number exactly).
 *
 * The field-name bridge Task 6a's reviewer flagged: ProductGrid/ProductCard
 * call onAdd(item: ProductRow) keyed as item.itemId; useCart.addItem expects
 * a CartItemInput keyed as id. handleAddToCart below is that adapter, kept
 * here rather than changing either Task 6a file's own type shape.
 */

type InlineCreate = { source: 'barcode' | 'nama'; value: string }

export function Kasir() {
  const cart = useCart()
  const rows = useProductCatalog()
  const [searchValue, setSearchValue] = useState('')
  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null)
  // Bumped to force SearchScanField to remount (and so autoFocus fires
  // again) after "Simpan & buat baru": the spec calls that button out as
  // existing "for batch runs", so the owner should land back in the search
  // field ready to start the next sale without reaching for the mouse.
  const [searchFieldKey, setSearchFieldKey] = useState(0)

  const trimmedSearch = searchValue.trim()
  // Matching strictness for "does this typed search match a known item" is
  // this task's judgment call (flagged in the brief): reuses
  // filterProductRows, the same case-insensitive substring match over
  // nama/barcode that ProductGrid itself uses to decide its own "Tidak ada
  // barang yang cocok" empty state, with kategori left null so an active
  // category pill in ProductGrid (which this component cannot see) never
  // produces a false "add new" offer for an item that actually exists.
  const searchHasNoMatches =
    rows !== undefined && trimmedSearch !== '' && filterProductRows(rows, trimmedSearch, null).length === 0

  const handleAddToCart = (item: ProductRow) => {
    cart.addItem({ id: item.itemId, nama: item.nama, baseUnit: item.baseUnit, hargaEceran: item.hargaEceran })
    // Clears whatever was typed to find this item, so a scan right after a
    // click-add starts its keystroke-timing run from an empty field rather
    // than one still holding earlier typed text (SearchScanField's own fix
    // handles the timing side of that; this clears the value side).
    setSearchValue('')
  }

  const handleScan = (value: string) => {
    // Flow spec section 6.1: "Unknown barcode offers 'Tambah barang baru'
    // inline, without leaving the cart." A scan is decisive (one value, no
    // further typing to wait out), so a miss opens the inline-creation
    // panel immediately rather than requiring an extra click.
    const match = rows?.find(row => row.barcode === value)
    if (match) {
      handleAddToCart(match)
      setInlineCreate(null)
    } else {
      setInlineCreate({ source: 'barcode', value })
    }
  }

  const handleInlineCreateSubmit = async (values: ItemFormValues) => {
    await recordItem(values, { clock: systemClock, deviceId: getDeviceId() })
    setInlineCreate(null)
    setSearchValue('')
  }

  const handleSaveAndNew = () => {
    setSearchValue('')
    setSearchFieldKey(key => key + 1)
  }

  const inlineCreateInitialValues =
    inlineCreate === null
      ? undefined
      : inlineCreate.source === 'barcode'
        ? { barcode: inlineCreate.value }
        : { nama: inlineCreate.value }

  return (
    <main className="flex flex-col gap-5 p-4 md:p-8">
      <h1 className="text-[17px] font-bold text-ink">Kasir</h1>

      <SearchScanField
        key={searchFieldKey}
        value={searchValue}
        onChange={setSearchValue}
        onScan={handleScan}
        autoFocus
      />

      {inlineCreate && (
        <section className="rounded-card border border-border bg-surface p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-[14px] font-bold text-ink">Tambah barang baru</h2>
            <button
              type="button"
              onClick={() => setInlineCreate(null)}
              className="min-h-tap rounded-tile px-3 text-[13px] font-medium text-ink-muted"
            >
              Tutup
            </button>
          </div>
          <ItemForm
            key={`${inlineCreate.source}:${inlineCreate.value}`}
            initialValues={inlineCreateInitialValues}
            onSubmit={handleInlineCreateSubmit}
          />
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
