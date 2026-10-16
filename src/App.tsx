import { memo, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './app/shell/Sidebar'
import { BottomNav } from './app/shell/BottomNav'
import { LoginReminder } from './app/shell/LoginReminder'
import { AppRoutes } from './app/routes'
import type { SyncStatus } from './data/sync'
import { db } from './data/db'
import { requestPersistentStorage } from './data/persistentStorage'
import { isSupabaseConfigured } from './data/supabaseConfig'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSupplierPerluDilengkapiCount } from './features/shared/useSupplierPerluDilengkapiCount'
import { usePiutangLewatTempoCount } from './features/piutang/usePiutangLewatTempoCount'
import { ToastProvider } from './ui/Toast'
import { useToast } from './ui/useToast'
import { useHariIni } from './features/shared/useHariIni'
import { bacaPengingatMasukDitutup, simpanPengingatMasukDitutup } from './data/tundaStore'
import { RouteAnnouncer } from './app/RouteAnnouncer'

type ShellProps = { syncStatus: SyncStatus; pendingCount: number }

// The shell re-renders on every saved event (the backup count moves), every
// sync status change and every badge count change. None of that is the open
// page's business: it reads its own data, and the router's context still
// reaches it on navigation, so the page is not re-rendered along with the shell.
const Pages = memo(AppRoutes)

// App renders BrowserRouter, so App itself is outside router context and
// cannot call useNavigate(). AppShell is mounted inside BrowserRouter
// specifically so its "open Kasir" handler can use react-router's own
// navigation instead of a bare window.history.pushState, which changes the
// address bar but never triggers a re-render of <Routes>.
function AppShell({ syncStatus, pendingCount }: ShellProps) {
  const navigate = useNavigate()
  // Closing the reminder holds for the rest of the day on this device (it used
  // to come back on every reload); useHariIni brings it back after midnight.
  const hariIni = useHariIni()
  const [reminderClosedOn, setReminderClosedOn] = useState(bacaPengingatMasukDitutup)
  const { showToast } = useToast()
  const supplierAlertCount = useSupplierPerluDilengkapiCount()
  const piutangAlertCount = usePiutangLewatTempoCount()
  const { pathname } = useLocation()
  // Not on Kasir (the counter screen stays clear, and never waits on this) nor
  // on the sign-in screen itself, where it would only repeat the page.
  const showLoginReminder = reminderClosedOn !== hariIni && syncStatus === 'belum-masuk' && pathname !== '/kasir' && pathname !== '/masuk'
  const closeLoginReminder = () => {
    simpanPengingatMasukDitutup(hariIni)
    setReminderClosedOn(hariIni)
    showToast('Pengingat muncul lagi besok. Status cadangan tetap ada di menu Lainnya.')
  }
  // react-router guarantees navigate's identity is stable across renders,
  // so wrapping it in useCallback keyed on it keeps openKasir stable too -
  // the F2 listener effect below depends on it and must not re-register on
  // every sync-driven re-render.
  const openKasir = useCallback(() => { navigate('/kasir') }, [navigate])

  // Moved from the deleted TopNav.tsx: F2 must keep working regardless of
  // which nav (Sidebar or BottomNav) the current viewport actually shows, so
  // the listener lives here, at the one place both are mounted from, rather
  // than duplicated into whichever nav happens to be visible.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Function key: scanners emit digits then Enter, so letters and digits
      // would fire on every scan.
      if (e.key === 'F2') {
        e.preventDefault()
        openKasir()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openKasir])

  return (
    <>
      {/* First tab stop on every page: without it a keyboard user tabs through
          the eight sidebar controls before reaching the content (WCAG 2.4.1). */}
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-pill focus:bg-focal focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-focal-fg"
      >
        Lewati ke konten
      </a>
      <Sidebar
        syncStatus={syncStatus}
        pendingCount={pendingCount}
        onNewTransaction={openKasir}
        supplierAlertCount={supplierAlertCount}
        piutangAlertCount={piutangAlertCount}
      />
      <div id="konten" tabIndex={-1} className="pb-24 outline-none md:pb-0 md:pl-[calc(var(--sidebar-w)+24px)]">
        {showLoginReminder && <LoginReminder pendingCount={pendingCount} onDismiss={closeLoginReminder} />}
        <Pages />
      </div>
      <RouteAnnouncer />
      <BottomNav onNewTransaction={openKasir} supplierAlertCount={supplierAlertCount} piutangAlertCount={piutangAlertCount} syncStatus={syncStatus} pendingCount={pendingCount} />
    </>
  )
}

export default function App() {
  // Starts at 'menyimpan' (not 'tersinkron') because the effect below kicks
  // off a sync on mount: setting it here, rather than synchronously inside
  // the effect, keeps the effect itself free of a same-tick setState call.
  // With no server configured the app is local-only by design: say so once,
  // neutrally, instead of an endless warning about a sync nobody set up.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isSupabaseConfigured ? 'menyimpan' : 'lokal')
  // Live, straight from the outbox, so the count moves the moment a sale is
  // saved instead of only after the next sync attempt.
  const pendingCount = useLiveQuery(() => db.outbox.count(), [], 0)

  // The event log on this device is the shop's data until it is backed up, and
  // a cashier who never signs in would otherwise never ask the browser to keep
  // it (Masuk.tsx asks only on sign-in). Best effort, never throws.
  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  // One effect owns every sync trigger, so there is exactly one listener to
  // register and exactly one place that can leak it. The effect body itself
  // performs the first sync (the "fetch on mount" shape
  // react-hooks/set-state-in-effect expects) and the same reporter closure is
  // reused by the 'online' handler, so a device that was offline for a day
  // catches up the moment the connection returns instead of waiting for a
  // reload. runSync pages the pull internally, so one trigger is enough to
  // drain an arbitrarily long backlog.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    // Sign-in and sign-out start and end syncs while an earlier one may still be
    // running. Only the newest run may report: an older one finishing late must
    // not overwrite "Belum masuk" after a sign-out, or a newer success after a sign-in.
    let latestRun = 0

    // Signing in (or out) on /masuk changes what the server will accept, so
    // sync must react at once instead of waiting for the next reload or
    // reconnect. Only these two events: INITIAL_SESSION and TOKEN_REFRESHED
    // are session housekeeping, not a change of who is signed in. Supabase also
    // re-emits SIGNED_IN when a tab regains focus with a valid session: the
    // sync is idempotent, so that is just a free catch-up, and an already
    // 'tersinkron' status is left alone rather than flickering to 'menyimpan'.
    const onAuthEvent = (event: string) => {
      if (event === 'SIGNED_IN') {
        setSyncStatus(current => (current === 'tersinkron' ? current : 'menyimpan'))
        void sync()
      } else if (event === 'SIGNED_OUT') {
        latestRun++ // whatever is still running was started as the signed-in owner
        setSyncStatus('belum-masuk')
      }
    }

    // The sync code and the Supabase client (a third of the app's JavaScript)
    // load after the first screen has painted, never in front of it. The auth
    // listener is registered before the first sync starts.
    const cloud = Promise.all([import('./data/sync'), import('./data/supabase')]).then(([syncModule, { supabase }]) => {
      if (!cancelled) {
        const { data } = supabase.auth.onAuthStateChange(onAuthEvent)
        unsubscribe = () => data.subscription.unsubscribe()
      }
      return syncModule
    })

    const sync = async () => {
      const run = ++latestRun
      let syncModule: Awaited<typeof cloud>
      try {
        syncModule = await cloud
      } catch {
        // The chunk could not load (offline before it was ever cached): the same
        // as any failed sync, retried on the next 'online'.
        if (!cancelled && run === latestRun) setSyncStatus('belum-tersinkron')
        return
      }
      try {
        await syncModule.runSync(syncModule.supabaseTransport)
        if (cancelled || run !== latestRun) return
        setSyncStatus('tersinkron')
      } catch (error) {
        // Offline is an expected state, not an error the user must action.
        // Not being signed in is different: it never resolves by itself, and
        // until it does nothing is backed up, so it gets its own message.
        if (cancelled || run !== latestRun) return
        setSyncStatus(error instanceof syncModule.BelumMasukError ? 'belum-masuk' : 'belum-tersinkron')
      }
    }

    void sync()

    const onOnline = () => {
      setSyncStatus('menyimpan')
      void sync()
    }
    window.addEventListener('online', onOnline)

    return () => {
      cancelled = true
      window.removeEventListener('online', onOnline)
      unsubscribe?.()
    }
  }, [])

  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell syncStatus={syncStatus} pendingCount={pendingCount} />
      </ToastProvider>
    </BrowserRouter>
  )
}
