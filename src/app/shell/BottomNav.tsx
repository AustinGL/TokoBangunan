import { NavLink } from 'react-router-dom'
import { PHONE_ITEMS } from './navItems'

type Props = { onNewTransaction: () => void }

export function BottomNav({ onNewTransaction }: Props) {
  const [first, second, third, fourth] = PHONE_ITEMS

  const tab = (item: typeof first) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex min-h-tap flex-1 flex-col items-center justify-center text-[12px] ${
          isActive ? 'text-success font-semibold' : 'text-ink-muted font-medium'
        }`
      }
    >
      {item.label}
    </NavLink>
  )

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-nav flex items-center border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tab(first)}
      {tab(second)}
      {/* mx-2 gives the FAB 8px of clearance from the tabs it sits between,
          matching MASTER.md section 11's spacing floor. The tabs themselves
          stay edge-to-edge: they are full-height flex-1 targets far wider than
          44px, and a gap between them would only open dead strips along the
          bottom edge of a phone. */}
      <button
        type="button"
        onClick={onNewTransaction}
        aria-label="Transaksi baru"
        className="mx-2 -mt-6 h-14 w-14 shrink-0 rounded-full bg-primary text-ink-on-primary shadow-card"
      >
        <span aria-hidden="true" className="text-2xl leading-none">+</span>
      </button>
      {tab(third)}
      {tab(fourth)}
    </nav>
  )
}
