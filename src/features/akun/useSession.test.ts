import { renderHook, waitFor, act } from '@testing-library/react'
import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock('../../data/supabase', () => ({ supabase: { auth } }))

import { useSession } from './useSession'

type Listener = (event: string, session: { user: { email?: string } } | null) => void
let listener: Listener
const unsubscribe = vi.fn()

beforeEach(() => {
  unsubscribe.mockReset()
  auth.getSession.mockReset()
  auth.onAuthStateChange.mockReset()
  auth.onAuthStateChange.mockImplementation((cb: Listener) => {
    listener = cb
    return { data: { subscription: { unsubscribe } } }
  })
})

describe('useSession', () => {
  it('starts as loading, then reports a stored session with its email', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'pemilik@toko.id' } } } })

    const { result } = renderHook(() => useSession())
    expect(result.current).toEqual({ status: 'memuat' })

    await waitFor(() => expect(result.current).toEqual({ status: 'masuk', email: 'pemilik@toko.id' }))
  })

  it('reports signed out when there is no stored session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })

    const { result } = renderHook(() => useSession())

    await waitFor(() => expect(result.current).toEqual({ status: 'keluar' }))
  })

  it('reads the stored session only, without needing the network, and falls back to signed out if that throws', async () => {
    auth.getSession.mockRejectedValue(new Error('storage unavailable'))

    const { result } = renderHook(() => useSession())

    await waitFor(() => expect(result.current).toEqual({ status: 'keluar' }))
  })

  it('follows sign-in and sign-out as they happen', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.status).toBe('keluar'))

    act(() => listener('SIGNED_IN', { user: { email: 'pemilik@toko.id' } }))
    expect(result.current).toEqual({ status: 'masuk', email: 'pemilik@toko.id' })

    act(() => listener('SIGNED_OUT', null))
    expect(result.current).toEqual({ status: 'keluar' })
  })

  it('treats a session with no email as signed in with an empty email rather than crashing', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: {} } } })

    const { result } = renderHook(() => useSession())

    await waitFor(() => expect(result.current).toEqual({ status: 'masuk', email: '' }))
  })

  it('stops listening when it unmounts', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    const { unmount } = renderHook(() => useSession())

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('reports "offline", not signed out, when the stored session cannot be checked for lack of network', async () => {
    // Offline with an expired access token: the refresh fails, so there is no session to show,
    // but the owner has not signed out and must not be asked for a password.
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) })

    const { result } = renderHook(() => useSession())

    await waitFor(() => expect(result.current).toEqual({ status: 'offline' }))
  })

  it('still reports signed out for an error that is not about the network', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: { name: 'AuthApiError', message: 'invalid refresh token', status: 400 } })

    const { result } = renderHook(() => useSession())

    await waitFor(() => expect(result.current).toEqual({ status: 'keluar' }))
  })

  it('does not let the start-up event (INITIAL_SESSION, null while offline) overwrite what getSession found', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) })
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.status).toBe('offline'))

    act(() => listener('INITIAL_SESSION', null))

    expect(result.current).toEqual({ status: 'offline' })
  })
})
