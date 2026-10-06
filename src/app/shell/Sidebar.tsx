import { useLayoutEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { NAV_ITEMS, DATA_MASTER_ITEMS, type NavItem } from './navItems'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/Icon'
import { NotifDot } from '../../ui/NotifDot'
import { SyncIndicator } from '../../ui/SyncIndicator'
import type { SyncStatus } from '../../data/sync'
import { BrandMark } from '../../ui/BrandIcons'

type Props = {
  syncStatus: SyncStatus
  pendingCount: number
  onNewTransaction: () => void
  /** Count of supplier records missing their optional details. 0 hides the dot. */
  supplierAlertCount: number
  /** Count of customers who are lewat tempo. 0 (or absent) hides the dot on Piutang. */
  piutangAlertCount?: number
}

function SidebarLink({ item, badgeCount = 0, badgeArti = 'perlu dilengkapi' }: { item: NavItem; badgeCount?: number; badgeArti?: string }) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      viewTransition
      aria-label={badgeCount > 0 ? `${item.label}, ${badgeCount} ${badgeArti}` : undefined}
      className={({ isActive }) =>
        `group relative z-10 flex min-h-control items-center gap-3 rounded-field px-3 text-sm transition-colors duration-quick ease-in-out ${
          isActive
            ? 'font-semibold text-ink'
            : 'font-medium text-[var(--sidebar-muted)] hover:bg-fill-tertiary hover:text-[var(--sidebar-ink)]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon icon={item.icon} size="nav" className={`shrink-0 transition-colors duration-quick ${isActive ? 'text-primary-ink' : ''}`} />
          <span className="flex-1">{item.label}</span>
          {badgeCount > 0 && <NotifDot />}
        </>
      )}
    </NavLink>
  )
}

/**
 * Desktop navigation (>=768px, matching BottomNav's own md:hidden
 * breakpoint so exactly one of the two is ever visible at a time).
 * A floating glass source list: the one translucent layer on screen. The
 * active highlight is a single element that glides between destinations on a
 * spring instead of each link toggling its own background.
 *
 * F2 is registered by App.tsx (AppShell), not here, so the shortcut keeps
 * working regardless of which nav the current viewport actually shows.
 */
export function Sidebar({ syncStatus, pendingCount, onNewTransaction, supplierAlertCount, piutangAlertCount = 0 }: Props) {
  const { pathname } = useLocation()
  const onKasir = pathname === '/kasir'
  const navRef = useRef<HTMLElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)

  // Slide the highlight to the link that is current. Written straight to the
  // element's style: it follows measured layout, not React state, and the
  // transition is switched on only after the first placement so it never
  // glides in from the top on load.
  useLayoutEffect(() => {
    const nav = navRef.current
    const thumb = thumbRef.current
    if (!nav || !thumb) return
    const place = () => {
      const current = nav.querySelector<HTMLElement>('a[aria-current="page"]')
      thumb.style.opacity = current ? '1' : '0'
      if (!current) return
      thumb.style.transform = `translateY(${current.offsetTop}px)`
    }
    place()
    const frame = requestAnimationFrame(() => thumb.classList.add('transition-[transform,opacity]', 'duration-panel', 'ease-spring'))
    window.addEventListener('resize', place)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', place) }
  }, [pathname])

  return (
    <aside className="glass-panel fixed inset-y-3 left-3 z-nav hidden w-sidebar flex-col gap-4 overflow-y-auto rounded-card-xl p-3 md:flex">
      <header className="flex flex-col gap-4 px-1 pb-1 pt-1">
        <div className="flex items-center gap-3">
          <BrandMark className="size-9 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-5 text-[var(--sidebar-ink)]">Toko Bahan Bangunan</div>
            <div className="text-xs text-[var(--sidebar-faint)]">Workspace operasional</div>
          </div>
        </div>

        <Button
          variant="primary"
          fullWidth
          onClick={onNewTransaction}
          aria-label="+ Transaksi baru"
          aria-current={onKasir ? 'page' : undefined}
          className={onKasir ? 'ring-4 ring-primary/20' : undefined}
        >
          <Icon icon={Plus} size="button" />
          <span className="flex-1 text-left">Transaksi baru</span>
          <span aria-hidden="true" className="rounded-md bg-white/20 px-1.5 py-0.5 text-2xs font-semibold">F2</span>
        </Button>
      </header>

      <nav ref={navRef} aria-label="Navigasi utama" className="relative flex flex-1 flex-col gap-0.5">
        <span
          ref={thumbRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-control rounded-field bg-[var(--sidebar-active)] opacity-0"
        />
        {NAV_ITEMS.map(item => (
          <SidebarLink
            key={item.path}
            item={item}
            badgeCount={item.path === '/piutang' ? piutangAlertCount : 0}
            badgeArti="lewat tempo"
          />
        ))}

        <div className="mb-1 mt-5 px-3 text-xs font-medium text-[var(--sidebar-faint)]">
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

      <div className="border-t border-[var(--sidebar-border)] px-1 pt-3">
      {syncStatus === 'lokal' ? (
        // No server configured: there is nothing to sign in to.
        <div className="sidebar-sync rounded-field bg-[var(--sidebar-raised)] px-3 py-3">
          <SyncIndicator status={syncStatus} pendingCount={pendingCount} />
        </div>
      ) : (
        <Link
          to="/masuk"
          viewTransition
          className="sidebar-sync flex min-h-control items-center rounded-field bg-[var(--sidebar-raised)] px-3 transition-colors duration-quick hover:bg-fill"
        >
          <SyncIndicator status={syncStatus} pendingCount={pendingCount} />
          <span className="sr-only"> Buka akun</span>
        </Link>
      )}
      </div>
    </aside>
  )
}
