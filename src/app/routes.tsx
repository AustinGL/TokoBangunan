import { lazy, Suspense } from 'react'
import { BarChart3, Home, Wallet } from 'lucide-react'
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
const Supplier = lazy(() => import('../features/supplier/Supplier').then(module => ({ default: module.Supplier })))
const Masuk = lazy(() => import('../features/akun/Masuk').then(module => ({ default: module.Masuk })))

const Placeholder = ({ name, icon, nextStep, to }: { name: string; icon: typeof Wallet; nextStep: string; to: string }) => (
  <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-8">
    <PageHeader title={name} />
    <EmptyState
      icon={icon}
      action={<ButtonLink to={to} variant="secondary">{nextStep}</ButtonLink>}
    >
      Fitur {name.toLowerCase()} sedang disiapkan. Data toko lainnya tetap bisa dipakai seperti biasa.
    </EmptyState>
  </main>
)

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
        <Route path="/piutang"   element={<Placeholder name="Piutang" icon={Wallet} nextStep="Lihat transaksi" to="/transaksi" />} />
        <Route path="/supplier"  element={<Supplier />} />
        <Route path="/laporan"   element={<Placeholder name="Laporan" icon={BarChart3} nextStep="Buka Beranda" to="/" />} />
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
