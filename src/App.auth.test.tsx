import 'fake-indexeddb/auto'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from './data/db'

const h = vi.hoisted(() => ({
  runSync: vi.fn(),
  listener: null as null | ((event: string) => void),
  unsubscribe: vi.fn(),
}))

vi.mock('./data/sync', async importActual => ({
  ...(await importActual<typeof import('./data/sync')>()),
  runSync: h.runSync,
}))

vi.mock('./data/supabase', async importActual => {
  const actual = await importActual<typeof import('./data/supabase')>()
  vi.spyOn(actual.supabase.auth, 'onAuthStateChange').mockImplementation(((cb: (event: string) => void) => {
    h.listener = cb
    return { data: { subscription: { unsubscribe: h.unsubscribe } } }
  }) as never)
  // The shop is connected to a cloud project in every test below.
  return { ...actual, isSupabaseConfigured: true }
})

import { BelumMasukError } from './data/sync'
import App from './App'

beforeEach(async () => {
  await db.delete()
  await db.open()
  h.runSync.mockReset()
  h.unsubscribe.mockReset()
  h.listener = null
})

describe('App: sync follows the owner signing in and out', () => {
  it('starts backing up as soon as the owner signs in, without a reload', async () => {
    h.runSync.mockRejectedValueOnce(new BelumMasukError())
    render(<App />)
    expect(await screen.findByText(/^Belum masuk/)).toBeInTheDocument()

    h.runSync.mockResolvedValue(undefined)
    await act(async () => { h.listener!('SIGNED_IN') })

    expect(await screen.findByText('Tersinkron')).toBeInTheDocument()
    expect(h.runSync).toHaveBeenCalledTimes(2)
  })

  it('goes back to "Belum masuk" when the owner signs out', async () => {
    h.runSync.mockResolvedValue(undefined)
    render(<App />)
    expect(await screen.findByText('Tersinkron')).toBeInTheDocument()

    await act(async () => { h.listener!('SIGNED_OUT') })

    expect(await screen.findByText(/^Belum masuk/)).toBeInTheDocument()
  })

  it('does not sync again for the start-up and token-refresh events, only for a real sign-in', async () => {
    h.runSync.mockResolvedValue(undefined)
    render(<App />)
    await screen.findByText('Tersinkron')
    expect(h.runSync).toHaveBeenCalledTimes(1)

    await act(async () => {
      h.listener!('INITIAL_SESSION')
      h.listener!('TOKEN_REFRESHED')
    })

    expect(h.runSync).toHaveBeenCalledTimes(1)
  })

  it('stops listening when the app unmounts', async () => {
    h.runSync.mockResolvedValue(undefined)
    const { unmount } = render(<App />)
    await screen.findByText('Tersinkron')

    unmount()

    expect(h.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
