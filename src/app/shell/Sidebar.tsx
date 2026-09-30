import { Link, NavLink } from 'react-router-dom'
import { Store } from 'lucide-react'
import { NAV_ITEMS, DATA_MASTER_ITEMS, type NavItem } from './navItems'
import { NotifDot } from '../../ui/NotifDot'
import { SyncIndicator } from '../../ui/SyncIndicator'
import type { SyncStatus } from '../../data/sync'

type Props = {
  syncStatus: SyncStatus
  pendingCount: number
  onNewTransaction: () => void
  /** Count of supplier records missing their optional details. 0 hides the dot. */
  supplierAlertCount: number
}

function SidebarLink({ item, badgeCount = 0 }: { item: NavItem; badgeCount?: number }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      aria-label={badgeCount > 0 ? `${item.label}, ${badgeCount} perlu dilengkapi` : undefined}
      className={({ isActive }) =>
        `flex min-h-tap items-center gap-3 rounded-pill px-4 text-[14px] ${
          isActive ? 'bg-accent-50 font-semibold text-primary' : 'font-medium text-ink-muted'
        }`
      }
    >
      <Icon aria-hidden="true" size={18} />
      <span className="flex-1">{item.label}</span>
      {badgeCount > 0 && <NotifDot />}
    </NavLink>
  )
}

/**
 * Desktop navigation (>=768px, matching BottomNav's own md:hidden
 * breakpoint so exactly one of the two is ever visible at a time).
 * Replaces the old horizontal TopNav: seven destinations (five primary plus
 * two grouped under "Data master") no longer fit on one line, so this is a
 * vertical sidebar instead.
 *
 * F2 is registered by App.tsx (AppShell), not here, so the shortcut keeps
 * working regardless of which nav the current viewport actually shows.
 */
export function Sidebar({ syncStatus, pendingCount, onNewTransaction, supplierAlertCount }: Props) {
  return (
    <aside className="fixed inset-y-0 left-0 z-nav hidden border-r border-border bg-surface w-[248px] flex-col gap-6 overflow-y-auto p-5 md:flex">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-tile bg-primary text-ink-on-primary" aria-hidden="true">
            <Store size={20} />
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-ink">Toko Bahan Bangunan</div>
            <div className="text-[12px] text-ink-faint">
              {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onNewTransaction}
          className="min-h-tap rounded-pill bg-[var(--btn-primary-bg)] px-4 text-[14px] font-bold text-[var(--btn-primary-fg)]"
        >
          + Transaksi baru
        </button>
      </header>

      <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(item => (
          <SidebarLink key={item.path} item={item} />
        ))}

        <div className="mb-1 mt-4 px-3 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
          Data master
        </div>
        {DATA_MASTER_ITEMS.map(item => (
          <SidebarLink
            key={item.path}
            item={item}
            badgeCount={item.path === '/supplier' ? supplierAlertCount : 0}
          />
        ))}
      </nav>

      {syncStatus === 'lokal' ? (
        // No server configured: there is nothing to sign in to.
        <SyncIndicator status={syncStatus} pendingCount={pendingCount} />
      ) : (
        <Link
          to="/masuk"
          className="-mx-2 flex min-h-tap items-center rounded-tile px-2 hover:bg-[var(--table-row-hover)]"
        >
          <SyncIndicator status={syncStatus} pendingCount={pendingCount} />
          <span className="sr-only"> Buka akun</span>
        </Link>
      )}
    </aside>
  )
}
