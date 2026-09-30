import { useEffect, useState } from 'react'
import { supabase } from '../../data/supabase'

export type SessionState =
  | { status: 'memuat' }
  | { status: 'keluar' }
  | { status: 'masuk'; email: string }

type SessionLike = { user: { email?: string | null } } | null

const toState = (session: SessionLike): SessionState =>
  session ? { status: 'masuk', email: session.user.email ?? '' } : { status: 'keluar' }

/**
 * Who is signed in, from the session Supabase keeps on this device. Reading it
 * never needs the network, so the account screen works offline too: being
 * offline is not the same as being signed out.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'memuat' })

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(
      ({ data }) => { if (!cancelled) setState(toState(data.session)) },
      () => { if (!cancelled) setState({ status: 'keluar' }) },
    )

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setState(toState(session))
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
