import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navItems'
import { SyncIndicator } from '../../ui/SyncIndicator'
import type { SyncStatus } from '../../data/sync'

type Props = {
  syncStatus: SyncStatus
  pendingCount: number
  onNewTransaction: () => void
}

export function TopNav({ syncStatus, pendingCount, onNewTransaction }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Function key: scanners emit digits then Enter, so letters and digits
      // would fire on every scan.
      if (e.key === 'F2') {
        e.preventDefault()
        onNewTransaction()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNewTransaction])

  return (
    <header className="hidden md:flex items-center gap-5 px-8 py-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-tile bg-brand-mint" aria-hidden="true" />
        <div>
          <div className="text-[17px] font-extrabold text-ink">Toko Bahan Bangunan</div>
          <div className="text-[12px] text-ink-faint">
            {new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}
          </div>
        </div>
      </div>

      <nav className="flex gap-1 rounded-field border border-border bg-surface p-1">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `min-h-tap flex items-center rounded-tile px-3 text-[14px] ${
                isActive ? 'bg-mint-tint text-success font-semibold' : 'text-ink-muted font-medium'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <SyncIndicator status={syncStatus} pendingCount={pendingCount} />
        <button
          type="button"
          onClick={onNewTransaction}
          className="min-h-tap rounded-tile bg-primary px-4 font-bold text-ink-on-primary"
        >
          Transaksi baru
        </button>
      </div>
    </header>
  )
}
