import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { MoreHorizontal, Plus } from 'lucide-react'
import { PHONE_ITEMS } from './navItems'
import { NotifDot } from '../../ui/NotifDot'
import { LainnyaSheet } from './LainnyaSheet'

type Props = {
  onNewTransaction: () => void
  /** Count of supplier records missing their optional details. 0 hides the dot on the Lainnya tab. */
  supplierAlertCount: number
}

export function BottomNav({ onNewTransaction, supplierAlertCount }: Props) {
  const [lainnyaOpen, setLainnyaOpen] = useState(false)
  const [first, second, third] = PHONE_ITEMS

  const tab = (item: typeof first) => {
    const Icon = item.icon
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === '/'}
        className={({ isActive }) =>
          `flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 text-[12px] ${
            isActive ? 'font-semibold text-primary' : 'font-medium text-ink-muted'
          }`
        }
      >
        <Icon aria-hidden="true" size={18} />
        {item.label}
      </NavLink>
    )
  }

  return (
    <>
      <nav
        aria-label="Navigasi telepon"
        className="glass fixed inset-x-0 bottom-0 z-nav flex items-center pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {tab(first)}
        {tab(second)}
        {/* mx-2 gives the FAB 8px of clearance from the tabs it sits between,
            matching the 8px spacing floor. The tabs themselves stay
            edge-to-edge: they are full-height flex-1 targets far wider than
            44px, and a gap between them would only open dead strips along
            the bottom edge of a phone. */}
        <button
          type="button"
          onClick={onNewTransaction}
          aria-label="Transaksi baru"
          className="mx-2 -mt-6 h-14 w-14 shrink-0 rounded-full bg-primary text-ink-on-primary shadow-panel"
        >
          <Plus aria-hidden="true" size={24} className="mx-auto" />
        </button>
        {tab(third)}
        <button
          type="button"
          onClick={() => setLainnyaOpen(true)}
          aria-label={supplierAlertCount > 0 ? `Lainnya, ${supplierAlertCount} perlu dilengkapi` : undefined}
          className="flex min-h-tap flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-medium text-ink-muted"
        >
          <span className="relative">
            <MoreHorizontal aria-hidden="true" size={18} />
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
      />
    </>
  )
}
