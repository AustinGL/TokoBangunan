import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { Sidebar } from './app/shell/Sidebar'
import { BottomNav } from './app/shell/BottomNav'
import { AppRoutes } from './app/routes'
import { runSync, supabaseTransport, type SyncStatus } from './data/sync'
import { getUnsyncedEvents } from './data/eventStore'
import { useSupplierPerluDilengkapiCount } from './features/shared/useSupplierPerluDilengkapiCount'

type ShellProps = { syncStatus: SyncStatus; pendingCount: number }

// App renders BrowserRouter, so App itself is outside router context and
// cannot call useNavigate(). AppShell is mounted inside BrowserRouter
// specifically so its "open Kasir" handler can use react-router's own
// navigation instead of a bare window.history.pushState, which changes the
// address bar but never triggers a re-render of <Routes>.
function AppShell({ syncStatus, pendingCount }: ShellProps) {
  const navigate = useNavigate()
  const supplierAlertCount = useSupplierPerluDilengkapiCount()
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
      <Sidebar
        syncStatus={syncStatus}
        pendingCount={pendingCount}
        onNewTransaction={openKasir}
        supplierAlertCount={supplierAlertCount}
      />
      <div className="pb-24 md:pb-0 md:pl-[248px]">
        <AppRoutes />
      </div>
      <BottomNav onNewTransaction={openKasir} supplierAlertCount={supplierAlertCount} />
    </>
  )
}

export default function App() {
  // Starts at 'menyimpan' (not 'tersinkron') because the effect below kicks
  // off a sync on mount: setting it here, rather than synchronously inside
  // the effect, keeps the effect itself free of a same-tick setState call.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('menyimpan')
  const [pendingCount, setPendingCount] = useState(0)

  // One effect owns every sync trigger, so there is exactly one listener to
  // register and exactly one place that can leak it. The effect body itself
  // performs the first sync (the "fetch on mount" shape
  // react-hooks/set-state-in-effect expects) and the same reporter closure is
  // reused by the 'online' handler, so a device that was offline for a day
  // catches up the moment the connection returns instead of waiting for a
  // reload. runSync pages the pull internally, so one trigger is enough to
  // drain an arbitrarily long backlog.
  useEffect(() => {
    let cancelled = false

    const sync = async () => {
      try {
        await runSync(supabaseTransport)
        if (cancelled) return
        setPendingCount(0)
        setSyncStatus('tersinkron')
      } catch {
        // Offline is an expected state, not an error the user must action.
        const pending = await getUnsyncedEvents()
        if (cancelled) return
        setPendingCount(pending.length)
        setSyncStatus('belum-tersinkron')
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
    }
  }, [])

  return (
    <BrowserRouter>
      <AppShell syncStatus={syncStatus} pendingCount={pendingCount} />
    </BrowserRouter>
  )
}
