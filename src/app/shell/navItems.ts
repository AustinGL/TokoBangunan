import type { ComponentType } from 'react'
import { Home, Receipt, Package, Wallet, BarChart3, BookOpen, Truck } from 'lucide-react'

export type IconType = ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>

export type NavItem = { label: string; path: string; icon: IconType }

/**
 * Primary destinations, shown in the desktop Sidebar (Sidebar.tsx) in this
 * order. Kamus Barang and Supplier render separately, under their own
 * "Data master" heading (DATA_MASTER_ITEMS below) - reference data the
 * owner maintains, not a daily flow, so they are visually grouped apart.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Beranda',   path: '/',          icon: Home },
  { label: 'Transaksi', path: '/transaksi', icon: Receipt },
  { label: 'Stok',      path: '/stok',      icon: Package },
  { label: 'Piutang',   path: '/piutang',   icon: Wallet },
  { label: 'Laporan',   path: '/laporan',   icon: BarChart3 },
]

/**
 * "Data master" group. Supplier can carry a notification badge (a
 * quick-added supplier missing its optional details) - see the
 * supplierAlertCount prop threaded through Sidebar/BottomNav/LainnyaSheet
 * from App.tsx.
 */
export const DATA_MASTER_ITEMS: NavItem[] = [
  { label: 'Kamus Barang', path: '/kamus',    icon: BookOpen },
  { label: 'Supplier',     path: '/supplier', icon: Truck },
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
  { label: 'Beranda', path: '/',        icon: Home },
  { label: 'Stok',    path: '/stok',    icon: Package },
  { label: 'Piutang', path: '/piutang', icon: Wallet },
]

/** LainnyaSheet's own destination list: everything BottomNav's tabs don't cover. */
export const LAINNYA_ITEMS: NavItem[] = [
  { label: 'Transaksi',    path: '/transaksi', icon: Receipt },
  { label: 'Kamus Barang', path: '/kamus',     icon: BookOpen },
  { label: 'Supplier',     path: '/supplier',  icon: Truck },
  { label: 'Laporan',      path: '/laporan',   icon: BarChart3 },
]
