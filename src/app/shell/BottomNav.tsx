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
      <button
        type="button"
        onClick={onNewTransaction}
        aria-label="Transaksi baru"
        className="-mt-6 h-14 w-14 shrink-0 rounded-full bg-primary text-ink-on-primary shadow-card"
      >
        <span aria-hidden="true" className="text-2xl leading-none">+</span>
      </button>
      {tab(third)}
      {tab(fourth)}
    </nav>
  )
}
