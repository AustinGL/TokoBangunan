import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MoreHorizontal, Plus } from 'lucide-react'
import { PHONE_ITEMS } from './navItems'
import { NotifDot } from '../../ui/NotifDot'
import { Icon } from '../../ui/Icon'
import { LainnyaSheet } from './LainnyaSheet'
import type { SyncStatus } from '../../data/sync'

type Props = {
  onNewTransaction: () => void
  /** Count of supplier records missing their optional details. 0 hides the dot on the Lainnya tab. */
  supplierAlertCount: number
  syncStatus: SyncStatus
  pendingCount: number
}

export function BottomNav({ onNewTransaction, supplierAlertCount, syncStatus, pendingCount }: Props) {
  const [lainnyaOpen, setLainnyaOpen] = useState(false)
  const [first, second, third] = PHONE_ITEMS
  // On Kasir itself the centre action would open the screen you are already on.
  const onKasir = useLocation().pathname === '/kasir'

  const tab = (item: typeof first) => {
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === '/'}
        className={({ isActive }) =>
          `flex min-h-control flex-1 flex-col items-center justify-center gap-0.5 text-[12px] ${
            isActive ? 'font-semibold text-primary' : 'font-medium text-ink-muted'
          }`
        }
      >
        <Icon icon={item.icon} size="nav" />
        {item.label}
      </NavLink>
    )
  }

  return (
    <>
      <nav
        aria-label="Navigasi telepon"
        className="fixed inset-x-0 bottom-0 z-nav flex items-center border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tab(first)}
        {tab(second)}
        {/* mx-2 gives the FAB 8px of clearance from the tabs it sits between,
            matching the 8px spacing floor. The tabs themselves stay
            edge-to-edge: they are full-height flex-1 targets far wider than
            44px, and a gap between them would only open dead strips along
            the bottom edge of a phone. */}
        {onKasir ? (
          // Keeps the four tabs where they are, with no button to press.
          <span aria-hidden="true" className="mx-2 h-14 w-14 shrink-0" />
        ) : (
          <button
            type="button"
            onClick={onNewTransaction}
            aria-label="Transaksi baru"
            className="mx-2 -mt-6 h-14 w-14 shrink-0 rounded-full bg-primary text-ink-on-primary shadow-panel"
          >
            <Icon icon={Plus} size="fab" className="mx-auto" />
          </button>
        )}
        {tab(third)}
        <button
          type="button"
          onClick={() => setLainnyaOpen(true)}
          aria-label={supplierAlertCount > 0 ? `Lainnya, ${supplierAlertCount} perlu dilengkapi` : undefined}
          className="flex min-h-control flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-medium text-ink-muted"
        >
          <span className="relative">
            <Icon icon={MoreHorizontal} size="nav" />
            {supplierAlertCount > 0 && (
              <span className="absolute -right-1 -top-1">
                <NotifDot />
              </span>
            )}
          </span>
          Lainnya
        </button>
      </nav>

      <LainnyaSheet
        open={lainnyaOpen}
        onClose={() => setLainnyaOpen(false)}
        supplierAlertCount={supplierAlertCount}
        syncStatus={syncStatus}
        pendingCount={pendingCount}
      />
    </>
  )
}
