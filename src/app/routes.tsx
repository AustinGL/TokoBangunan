import { Routes, Route, Navigate } from 'react-router-dom'
import { ItemList } from '../features/stok/ItemList'
import { Kasir } from '../features/kasir/Kasir'
import { SaleList } from '../features/transaksi/SaleList'

const Placeholder = ({ name }: { name: string }) => (
  <main className="p-8">
    <h1 className="text-[17px] font-bold text-ink">{name}</h1>
    <p className="mt-2 text-[14px] text-ink-muted">Layar ini dibangun di fase berikutnya.</p>
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
      <Route path="/kamus"     element={<Placeholder name="Kamus Barang" />} />
      <Route path="/kasir"     element={<Kasir />} />
      {/* Lainnya is a sheet now (BottomNav.tsx / LainnyaSheet.tsx), not a
          route: its old destinations (Transaksi, Supplier, Laporan) are all
          real screens already, reachable directly, and Kamus Barang joined
          them. A legacy bookmark to /lainnya redirects home rather than
          404ing, since the path was never a typo, just retired. */}
      <Route path="/lainnya"   element={<Navigate to="/" replace />} />
      {/* Genuinely unmatched paths (typos, stale bookmarks, future dead
          links) get honest not-found copy, not the Kasir label above. */}
      <Route path="*"          element={<NotFound />} />
    </Routes>
  )
}
