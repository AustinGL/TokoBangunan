import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { TopNav } from './app/shell/TopNav'
import { BottomNav } from './app/shell/BottomNav'
import { AppRoutes } from './app/routes'
import { runSync, supabaseTransport, type SyncStatus } from './data/sync'
import { getUnsyncedEvents } from './data/eventStore'

type ShellProps = { syncStatus: SyncStatus; pendingCount: number }

// App renders BrowserRouter, so App itself is outside router context and
// cannot call useNavigate(). AppShell is mounted inside BrowserRouter
// specifically so its "open Kasir" handler can use react-router's own
// navigation instead of a bare window.history.pushState, which changes the
// address bar but never triggers a re-render of <Routes>.
function AppShell({ syncStatus, pendingCount }: ShellProps) {
  const navigate = useNavigate()
  // react-router guarantees navigate's identity is stable across renders,
  // so wrapping it in useCallback keyed on it keeps openKasir stable too -
  // TopNav's F2 listener effect depends on onNewTransaction and must not
  // re-register on every sync-driven re-render.
  const openKasir = useCallback(() => { navigate('/kasir') }, [navigate])

  return (
    <>
      <TopNav syncStatus={syncStatus} pendingCount={pendingCount} onNewTransaction={openKasir} />
      <div className="pb-24 md:pb-0">
        <AppRoutes />
      </div>
      <BottomNav onNewTransaction={openKasir} />
    </>
  )
}

export default function App() {
  // Starts at 'menyimpan' (not 'tersinkron') because the effect below kicks
  // off a sync on mount: setting it here, rather than synchronously inside
  // the effect, keeps the effect itself free of a same-tick setState call.
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('menyimpan')
  const [pendingCount, setPendingCount] = useState(0)

  // Inlined (rather than a useCallback referenced by the effect's deps) so the
  // effect body itself is the thing that performs the sync: this is the "fetch
  // on mount" shape react-hooks/set-state-in-effect expects, versus extracting
  // the async work into a separately defined, effect-invoked function.
  useEffect(() => {
    let cancelled = false

    void (async () => {
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
    })()

    return () => { cancelled = true }
  }, [])

  return (
    <BrowserRouter>
      <AppShell syncStatus={syncStatus} pendingCount={pendingCount} />
    </BrowserRouter>
  )
}
