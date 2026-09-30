import { Link } from 'react-router-dom'
import { LAINNYA_ITEMS } from './navItems'
import { NotifDot } from '../../ui/NotifDot'
import { Sheet } from '../../ui/Sheet'
import { SyncIndicator } from '../../ui/SyncIndicator'
import type { SyncStatus } from '../../data/sync'

type Props = {
  open: boolean
  onClose: () => void
  supplierAlertCount: number
  syncStatus: SyncStatus
  pendingCount: number
}

/**
 * Flow spec: "Lainnya holds: Transaksi, Supplier, Laporan" (Kamus Barang is
 * new since that spec was written, added alongside Supplier under the same
 * "reference data, not a daily flow" umbrella). Replaces the old /lainnya
 * route (routes.tsx), which was a dead end once its destinations became
 * real screens. A sheet (not a route) means BottomNav.tsx can open it from
 * any screen without a navigation round-trip, and it never needs its own
 * back-button handling.
 */
export function LainnyaSheet({ open, onClose, supplierAlertCount, syncStatus, pendingCount }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Lainnya" variant="side">
      <nav aria-label="Lainnya" className="flex flex-col gap-1">
        {LAINNYA_ITEMS.map(item => {
          const Icon = item.icon
          const badgeCount = item.path === '/supplier' ? supplierAlertCount : 0
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              aria-label={badgeCount > 0 ? `${item.label}, ${badgeCount} perlu dilengkapi` : undefined}
              className="flex min-h-tap items-center gap-3 rounded-tile px-3 text-[14px] font-medium text-ink"
            >
              <Icon aria-hidden="true" size={18} />
              <span className="flex-1">{item.label}</span>
              {badgeCount > 0 && <NotifDot />}
            </Link>
          )
        })}
      </nav>

      {/* A phone has no sidebar, so this is the only place its owner can see the
          backup status and reach the sign-in screen. Nothing to sign in to when
          the shop is local-only. Only while open: a closed sheet still keeps its
          children in the DOM, which would double the sidebar's live status. */}
      {open && syncStatus !== 'lokal' && (
        <Link
          to="/masuk"
          onClick={onClose}
          className="mt-4 flex min-h-tap flex-col gap-1 rounded-tile border border-border px-3 py-2"
        >
          <span className="text-[14px] font-medium text-ink">Akun dan cadangan</span>
          <SyncIndicator status={syncStatus} pendingCount={pendingCount} />
        </Link>
      )}
    </Sheet>
  )
}
