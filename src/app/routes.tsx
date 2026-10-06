import { lazy, Suspense } from 'react'
import { Home } from 'lucide-react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ButtonLink } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ListSkeleton } from '../ui/ListSkeleton'
import { PageHeader } from '../ui/PageHeader'

const Beranda = lazy(() => import('../features/beranda/Beranda').then(module => ({ default: module.Beranda })))
const Stok = lazy(() => import('../features/stok/Stok').then(module => ({ default: module.Stok })))
const BarangDetail = lazy(() => import('../features/stok/BarangDetail').then(module => ({ default: module.BarangDetail })))
const Kasir = lazy(() => import('../features/kasir/Kasir').then(module => ({ default: module.Kasir })))
const SaleList = lazy(() => import('../features/transaksi/SaleList').then(module => ({ default: module.SaleList })))
const KamusBarang = lazy(() => import('../features/kamus/KamusBarang').then(module => ({ default: module.KamusBarang })))
const Kategori = lazy(() => import('../features/kategori/Kategori').then(module => ({ default: module.Kategori })))
const Pelanggan = lazy(() => import('../features/pelanggan/Pelanggan').then(module => ({ default: module.Pelanggan })))
const PelangganDetail = lazy(() => import('../features/pelanggan/PelangganDetail').then(module => ({ default: module.PelangganDetail })))
const Biaya = lazy(() => import('../features/biaya/Biaya').then(module => ({ default: module.Biaya })))
const Supplier = lazy(() => import('../features/supplier/Supplier').then(module => ({ default: module.Supplier })))
const Laporan = lazy(() => import('../features/laporan/Laporan').then(module => ({ default: module.Laporan })))
const Piutang = lazy(() => import('../features/piutang/Piutang').then(module => ({ default: module.Piutang })))
const PiutangDetail = lazy(() => import('../features/piutang/PiutangDetail').then(module => ({ default: module.PiutangDetail })))
const Masuk = lazy(() => import('../features/akun/Masuk').then(module => ({ default: module.Masuk })))

const NotFound = () => (
  <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
    <PageHeader title="Halaman tidak ditemukan" />
    <EmptyState icon={Home} action={<ButtonLink to="/">Kembali ke Beranda</ButtonLink>}>
      Alamat ini tidak tersedia atau sudah dipindahkan.
    </EmptyState>
  </main>
)

const RouteFallback = () => (
  <main className="mx-auto w-full max-w-6xl p-4 md:p-8">
    <ListSkeleton label="Memuat halaman..." rows={3} />
  </main>
)

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/"          element={<Beranda />} />
        <Route path="/transaksi" element={<SaleList />} />
        <Route path="/stok"      element={<Stok />} />
        <Route path="/stok/:barangKey" element={<BarangDetail />} />
        <Route path="/piutang"   element={<Piutang />} />
        <Route path="/piutang/:customerId" element={<PiutangDetail />} />
        <Route path="/pelanggan" element={<Pelanggan />} />
        <Route path="/pelanggan/:customerId" element={<PelangganDetail />} />
        <Route path="/supplier"  element={<Supplier />} />
        <Route path="/laporan"   element={<Laporan />} />
        <Route path="/biaya"     element={<Biaya />} />
        <Route path="/kamus"     element={<KamusBarang />} />
        <Route path="/kategori"  element={<Kategori />} />
        <Route path="/kasir"     element={<Kasir />} />
        {/* Optional: signing in only turns on cloud backup. Nothing links to it as a gate. */}
        <Route path="/masuk"     element={<Masuk />} />
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
    </Suspense>
  )
}
