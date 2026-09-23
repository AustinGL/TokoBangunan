import { Routes, Route, Link } from 'react-router-dom'
import { ItemList } from '../features/stok/ItemList'
import { Kasir } from '../features/kasir/Kasir'
import { SaleList } from '../features/transaksi/SaleList'

const Placeholder = ({ name }: { name: string }) => (
  <main className="p-8">
    <h1 className="text-[17px] font-bold text-ink">{name}</h1>
    <p className="mt-2 text-[14px] text-ink-muted">Layar ini dibangun di fase berikutnya.</p>
  </main>
)

/**
 * Flow spec section 4: "Lainnya holds: Transaksi, Supplier, Laporan." On a
 * phone, BottomNav's "Lainnya" tab is the only route to those three
 * destinations, so without real links here a phone user who just recorded a
 * sale in Kasir has no way to reach the now-real Transaksi screen short of
 * typing the URL. This is the minimal fix, not the full sheet UI the flow
 * spec describes: plain links, same spirit as Placeholder above.
 */
const Lainnya = () => (
  <main className="p-8">
    <h1 className="text-[17px] font-bold text-ink">Lainnya</h1>
    <nav className="mt-4 flex flex-col gap-2">
      <Link to="/transaksi" className="min-h-tap flex items-center rounded-tile px-3 text-[14px] font-medium text-ink-muted">
        Transaksi
      </Link>
      <Link to="/supplier" className="min-h-tap flex items-center rounded-tile px-3 text-[14px] font-medium text-ink-muted">
        Supplier
      </Link>
      <Link to="/laporan" className="min-h-tap flex items-center rounded-tile px-3 text-[14px] font-medium text-ink-muted">
        Laporan
      </Link>
    </nav>
  </main>
)

const NotFound = () => (
  <main className="p-8">
    <h1 className="text-[17px] font-bold text-ink">Halaman tidak ditemukan</h1>
    <p className="mt-2 text-[14px] text-ink-muted">Halaman yang Anda tuju tidak tersedia.</p>
  </main>
)

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<Placeholder name="Beranda" />} />
      <Route path="/transaksi" element={<SaleList />} />
      <Route path="/stok"      element={<ItemList />} />
      <Route path="/piutang"   element={<Placeholder name="Piutang" />} />
      <Route path="/supplier"  element={<Placeholder name="Supplier" />} />
      <Route path="/laporan"   element={<Placeholder name="Laporan" />} />
      <Route path="/lainnya"   element={<Lainnya />} />
      <Route path="/kasir"     element={<Kasir />} />
      {/* Genuinely unmatched paths (typos, stale bookmarks, future dead
          links) get honest not-found copy, not the Kasir label above. */}
      <Route path="*"          element={<NotFound />} />
    </Routes>
  )
}
