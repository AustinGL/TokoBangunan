export type NavItem = { label: string; path: string }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Beranda',   path: '/' },
  { label: 'Transaksi', path: '/transaksi' },
  { label: 'Stok',      path: '/stok' },
  { label: 'Piutang',   path: '/piutang' },
  { label: 'Supplier',  path: '/supplier' },
  { label: 'Laporan',   path: '/laporan' },
]

/**
 * Phone bar: four tabs plus the centre action. Stok beats Transaksi because
 * stock is checked on the warehouse floor far more often than history.
 *
 * Typed as a fixed-length tuple on purpose. BottomNav destructures exactly
 * four entries, so a plain NavItem[] would let a fifth tab be added here and
 * silently dropped from the bar. As a tuple, that is a compile error.
 */
export type PhoneNavItems = readonly [NavItem, NavItem, NavItem, NavItem]

export const PHONE_ITEMS: PhoneNavItems = [
  { label: 'Beranda', path: '/' },
  { label: 'Stok',    path: '/stok' },
  { label: 'Piutang', path: '/piutang' },
  { label: 'Lainnya', path: '/lainnya' },
]
