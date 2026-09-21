import { Routes, Route } from 'react-router-dom'
import { ItemList } from '../features/stok/ItemList'

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
      <Route path="/transaksi" element={<Placeholder name="Transaksi" />} />
      <Route path="/stok"      element={<ItemList />} />
      <Route path="/piutang"   element={<Placeholder name="Piutang" />} />
      <Route path="/supplier"  element={<Placeholder name="Supplier" />} />
      <Route path="/laporan"   element={<Placeholder name="Laporan" />} />
      <Route path="/lainnya"   element={<Placeholder name="Lainnya" />} />
      {/* No Kasir screen exists yet, but the primary "Transaksi baru" button
          and the F2 shortcut both navigate here. */}
      <Route path="/kasir"     element={<Placeholder name="Kasir" />} />
      {/* Genuinely unmatched paths (typos, stale bookmarks, future dead
          links) get honest not-found copy, not the Kasir label above. */}
      <Route path="*"          element={<NotFound />} />
    </Routes>
  )
}
