export type NavItem = { label: string; path: string }

export const NAV_ITEMS: NavItem[] = [
  { label: 'Beranda',   path: '/' },
  { label: 'Transaksi', path: '/transaksi' },
  { label: 'Stok',      path: '/stok' },
  { label: 'Piutang',   path: '/piutang' },
  { label: 'Supplier',  path: '/supplier' },
  { label: 'Laporan',   path: '/laporan' },
]

/** Phone bar: four tabs plus the centre action. Stok beats Transaksi because
 *  stock is checked on the warehouse floor far more often than history. */
export const PHONE_ITEMS: NavItem[] = [
  { label: 'Beranda', path: '/' },
  { label: 'Stok',    path: '/stok' },
  { label: 'Piutang', path: '/piutang' },
  { label: 'Lainnya', path: '/lainnya' },
]
