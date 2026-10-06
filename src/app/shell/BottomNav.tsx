import { useLayoutEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MoreHorizontal, Plus } from 'lucide-react'
import { LAINNYA_ITEMS, PHONE_ITEMS } from './navItems'
import { NotifDot } from '../../ui/NotifDot'
import { Icon } from '../../ui/Icon'
import { LainnyaSheet } from './LainnyaSheet'
import type { SyncStatus } from '../../data/sync'

type Props = {
  onNewTransaction: () => void
  /** Count of supplier records missing their optional details. 0 hides the dot on the Lainnya tab. */
  supplierAlertCount: number
  /** Count of customers who are lewat tempo. 0 (or absent) hides the dot on the Piutang tab. */
  piutangAlertCount?: number
  syncStatus: SyncStatus
  pendingCount: number
}

const TAB =
  'relative z-10 flex min-h-control flex-1 flex-col items-center justify-center gap-0.5 rounded-pill py-1.5 text-xs transition-colors duration-quick ease-in-out'

export function BottomNav({ onNewTransaction, supplierAlertCount, piutangAlertCount = 0, syncStatus, pendingCount }: Props) {
  const [lainnyaOpen, setLainnyaOpen] = useState(false)
  const [first, second, third] = PHONE_ITEMS
  const { pathname } = useLocation()
  const onKasir = pathname === '/kasir'
  const onLainnyaRoute = pathname === '/masuk' || LAINNYA_ITEMS.some(item => pathname === item.path)
  const capsuleRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)

  // The highlight is one capsule that glides to the current tab on a spring.
  // It follows measured layout (written to style, not React state), and the
  // slide is enabled only after the first placement.
  useLayoutEffect(() => {
    const capsule = capsuleRef.current
    const thumb = thumbRef.current
    if (!capsule || !thumb) return
    const place = () => {
      const current = capsule.querySelector<HTMLElement>('[aria-current="page"]')
      thumb.style.opacity = current ? '1' : '0'
      if (!current) return
      thumb.style.width = `${current.offsetWidth}px`
      thumb.style.transform = `translateX(${current.offsetLeft}px)`
    }
    place()
    const frame = requestAnimationFrame(() => thumb.classList.add('transition-[transform,width,opacity]', 'duration-panel', 'ease-spring'))
    window.addEventListener('resize', place)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', place) }
  }, [pathname])

  const tab = (item: typeof first) => {
    const badgeCount = item.path === '/piutang' ? piutangAlertCount : 0
    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === '/'}
        viewTransition
        aria-label={badgeCount > 0 ? `${item.label}, ${badgeCount} lewat tempo` : undefined}
        className={({ isActive }) => `${TAB} ${isActive ? 'font-semibold text-primary-ink' : 'font-medium text-ink-muted'}`}
      >
        {({ isActive }) => (
          <>
            <span key={isActive ? 'on' : 'off'} className={`relative ${isActive ? 'pop' : ''}`}>
              <Icon icon={item.icon} size="nav" />
              {badgeCount > 0 && (
                <span className="absolute -right-1 -top-1">
                  <NotifDot />
                </span>
              )}
            </span>
            {item.label}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <>
      <nav
        aria-label="Navigasi telepon"
        className="fixed inset-x-3 bottom-3 z-nav flex items-end gap-3 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {/* The tabs float in one glass capsule; the primary action stands
            apart from it as its own round button, as on iOS. */}
        <div ref={capsuleRef} className="glass-panel relative flex flex-1 items-center rounded-pill p-1.5">
          <span
            ref={thumbRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1.5 left-0 rounded-pill bg-fill opacity-0"
          />
          {tab(first)}
          {tab(second)}
          {tab(third)}
          <button
            type="button"
            onClick={() => setLainnyaOpen(true)}
            aria-label={supplierAlertCount > 0 ? `Lainnya, ${supplierAlertCount} perlu dilengkapi` : undefined}
            aria-current={onLainnyaRoute ? 'page' : undefined}
            aria-haspopup="dialog"
            aria-expanded={lainnyaOpen}
            className={`${TAB} ${onLainnyaRoute ? 'font-semibold text-primary-ink' : 'font-medium text-ink-muted'}`}
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
        </div>

        <button
          type="button"
          onClick={onNewTransaction}
          aria-label="Kasir · transaksi baru"
          aria-current={onKasir ? 'page' : undefined}
          className={`flex min-h-control size-14 shrink-0 items-center justify-center rounded-full bg-primary text-ink-on-primary shadow-float transition-[transform,background-color] duration-quick ease-spring hover:bg-primary-hover active:scale-90 ${onKasir ? 'ring-4 ring-primary/25' : ''}`}
        >
          <Icon icon={Plus} size="fab" />
          <span className="sr-only">Kasir</span>
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
