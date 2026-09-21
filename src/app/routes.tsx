import { Routes, Route } from 'react-router-dom'

const Placeholder = ({ name }: { name: string }) => (
  <main className="p-8">
    <h1 className="text-[17px] font-bold text-ink">{name}</h1>
    <p className="mt-2 text-[14px] text-ink-muted">Layar ini dibangun di fase berikutnya.</p>
  </main>
)

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/"          element={<Placeholder name="Beranda" />} />
      <Route path="/transaksi" element={<Placeholder name="Transaksi" />} />
      <Route path="/stok"      element={<Placeholder name="Stok" />} />
      <Route path="/piutang"   element={<Placeholder name="Piutang" />} />
      <Route path="/supplier"  element={<Placeholder name="Supplier" />} />
      <Route path="/laporan"   element={<Placeholder name="Laporan" />} />
      <Route path="/lainnya"   element={<Placeholder name="Lainnya" />} />
      {/* No route builds Kasir yet, but the primary "Transaksi baru" button
          and the F2 shortcut both navigate to /kasir. Without this, the
          app's most prominent action lands on a blank pane under a live
          nav bar. This also catches any other unmatched path. */}
      <Route path="*"          element={<Placeholder name="Kasir" />} />
    </Routes>
  )
}
