import { Link } from 'react-router-dom'
import { LAINNYA_ITEMS } from './navItems'
import { NotifDot } from '../../ui/NotifDot'
import { Sheet } from '../../ui/Sheet'

type Props = {
  open: boolean
  onClose: () => void
  supplierAlertCount: number
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
export function LainnyaSheet({ open, onClose, supplierAlertCount }: Props) {
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
    </Sheet>
  )
}
