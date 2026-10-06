import {
  CatalogIcon,
  CategoryIcon,
  CustomerIcon,
  DashboardIcon,
  ExpenseIcon,
  InventoryIcon,
  ReportIcon,
  SaleIcon,
  SupplierIcon,
  WalletIcon,
} from '../../ui/BrandIcons'
import type { LucideIcon } from 'lucide-react'

export type IconType = LucideIcon

export type NavItem = { label: string; path: string; icon: IconType }

/**
 * Primary destinations, shown in the desktop Sidebar (Sidebar.tsx) in this
 * order. Kamus Barang and Supplier render separately, under their own
 * "Data master" heading (DATA_MASTER_ITEMS below) - reference data the
 * owner maintains, not a daily flow, so they are visually grouped apart.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Beranda',   path: '/',          icon: DashboardIcon },
  { label: 'Transaksi', path: '/transaksi', icon: SaleIcon },
  { label: 'Stok',      path: '/stok',      icon: InventoryIcon },
  { label: 'Piutang',   path: '/piutang',   icon: WalletIcon },
  { label: 'Laporan',   path: '/laporan',   icon: ReportIcon },
  { label: 'Biaya',     path: '/biaya',     icon: ExpenseIcon },
]

/**
 * "Data master" group. Supplier can carry a notification badge (a
 * quick-added supplier missing its optional details) - see the
 * supplierAlertCount prop threaded through Sidebar/BottomNav/LainnyaSheet
 * from App.tsx.
 */
export const DATA_MASTER_ITEMS: NavItem[] = [
  { label: 'Kamus Barang', path: '/kamus',    icon: CatalogIcon },
  { label: 'Kategori',     path: '/kategori', icon: CategoryIcon },
  { label: 'Pelanggan',    path: '/pelanggan', icon: CustomerIcon },
  { label: 'Supplier',     path: '/supplier', icon: SupplierIcon },
]

/**
 * Phone bar: three tabs plus the centre action. Stok beats Transaksi
 * because stock is checked on the warehouse floor far more often than
 * history. "Lainnya" is not in this array: it is not a route, it is a
 * button that opens LainnyaSheet (see BottomNav.tsx), which holds
 * LAINNYA_ITEMS below.
 *
 * Typed as a fixed-length tuple on purpose. BottomNav destructures exactly
 * three entries, so a plain NavItem[] would let a fourth tab be added here
 * and silently dropped from the bar. As a tuple, that is a compile error.
 */
export type PhoneNavItems = readonly [NavItem, NavItem, NavItem]

export const PHONE_ITEMS: PhoneNavItems = [
  { label: 'Beranda', path: '/',        icon: DashboardIcon },
  { label: 'Stok',    path: '/stok',    icon: InventoryIcon },
  { label: 'Piutang', path: '/piutang', icon: WalletIcon },
]

/** LainnyaSheet's own destination list: everything BottomNav's tabs don't cover. */
export const LAINNYA_ITEMS: NavItem[] = [
  { label: 'Transaksi',    path: '/transaksi', icon: SaleIcon },
  { label: 'Kamus Barang', path: '/kamus',     icon: CatalogIcon },
  { label: 'Kategori',     path: '/kategori',  icon: CategoryIcon },
  { label: 'Pelanggan',    path: '/pelanggan', icon: CustomerIcon },
  { label: 'Supplier',     path: '/supplier',  icon: SupplierIcon },
  { label: 'Laporan',      path: '/laporan',   icon: ReportIcon },
  { label: 'Biaya',        path: '/biaya',     icon: ExpenseIcon },
]
