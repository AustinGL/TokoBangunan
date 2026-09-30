import { useEffect, useState } from 'react'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from '../../data/supabase'

export type SessionState =
  | { status: 'memuat' }
  | { status: 'keluar' }
  | { status: 'masuk'; email: string }
  // The stored session could not be checked because the device is offline (an
  // expired access token needs a refresh that failed). Not the same as signed out.
  | { status: 'offline' }

type SessionLike = { user: { email?: string | null } } | null

const toState = (session: SessionLike): SessionState =>
  session ? { status: 'masuk', email: session.user.email ?? '' } : { status: 'keluar' }

/**
 * Who is signed in, from the session Supabase keeps on this device. A fresh
 * session is read without the network, but one whose access token has expired
 * needs a refresh, and offline that fails: the answer is then "offline", never
 * "signed out" (which would invite the owner to retype a password that was not
 * the problem).
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'memuat' })

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(
      ({ data, error }) => {
        if (cancelled) return
        if (!data.session && error && isAuthRetryableFetchError(error)) setState({ status: 'offline' })
        else setState(toState(data.session))
      },
      () => { if (!cancelled) setState({ status: 'keluar' }) },
    )

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION is the start-up echo of what getSession already
      // answered, and it is null while offline: letting it through would undo
      // the "offline" answer above.
      if (event === 'INITIAL_SESSION' || cancelled) return
      setState(toState(session))
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
