import 'fake-indexeddb/auto'
import { render, screen, act, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
  return actual
})

// The shop is connected to a cloud project in every test below.
vi.mock('./data/supabaseConfig', async importActual => ({
  ...(await importActual<typeof import('./data/supabaseConfig')>()),
  isSupabaseConfigured: true,
}))

import { BelumMasukError } from './data/sync'
import App from './App'

beforeEach(async () => {
  await db.delete()
  await db.open()
  h.runSync.mockReset()
  h.unsubscribe.mockReset()
  h.listener = null
  window.history.pushState({}, '', '/')
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

  it('keeps "Belum masuk" when a sync that started before sign-out finishes afterwards', async () => {
    let finish: () => void = () => {}
    h.runSync.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve }))
    render(<App />)
    // The sync code loads lazily; the listener is registered before the first sync starts.
    await waitFor(() => expect(h.runSync).toHaveBeenCalledTimes(1))
    await act(async () => { h.listener!('SIGNED_OUT') })
    expect(await screen.findByText(/^Belum masuk/)).toBeInTheDocument()

    await act(async () => { finish() })

    expect(screen.getByText(/^Belum masuk/)).toBeInTheDocument()
    expect(screen.queryByText('Tersinkron')).toBeNull()
  })

  it('ignores a failure from an older sync once a newer one (after sign-in) has succeeded', async () => {
    let failOld: (error: Error) => void = () => {}
    h.runSync.mockReturnValueOnce(new Promise<void>((_, reject) => { failOld = reject }))
    h.runSync.mockResolvedValue(undefined)
    render(<App />)
    await waitFor(() => expect(h.runSync).toHaveBeenCalledTimes(1))

    await act(async () => { h.listener!('SIGNED_IN') })
    expect(await screen.findByText('Tersinkron')).toBeInTheDocument()

    await act(async () => { failOld(new BelumMasukError()) })

    expect(screen.getByText('Tersinkron')).toBeInTheDocument()
    expect(screen.queryByText(/^Belum masuk/)).toBeNull()
  })
})

describe('App: the reminder to sign in', () => {
  // A plain in-memory Storage, as in tundaStore.test.ts: independent of how the
  // host jsdom/Node pair wires up the real localStorage.
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('stays closed for the rest of the day once closed, across a reload', async () => {
    const user = userEvent.setup()
    h.runSync.mockRejectedValue(new BelumMasukError())
    const { unmount } = render(<App />)

    const reminder = await screen.findByRole('region', { name: 'Belum masuk' })
    await user.click(within(reminder).getByRole('button', { name: /Tutup pengingat masuk/ }))
    expect(screen.queryByRole('region', { name: 'Belum masuk' })).toBeNull()
    expect(await screen.findByText(/Pengingat muncul lagi besok/)).toBeInTheDocument()

    unmount()
    render(<App />)
    await screen.findByText(/^Belum masuk/) // still not signed in
    expect(screen.queryByRole('region', { name: 'Belum masuk' })).toBeNull()
  })

  it('comes back on a later day', async () => {
    localStorage.setItem('toko-pengingat-masuk-ditutup', '2000-01-01')
    h.runSync.mockRejectedValue(new BelumMasukError())
    render(<App />)

    expect(await screen.findByRole('region', { name: 'Belum masuk' })).toBeInTheDocument()
  })

  it('asks the owner to sign in while not signed in, and stops asking once signed in', async () => {
    h.runSync.mockRejectedValueOnce(new BelumMasukError())
    render(<App />)

    const reminder = await screen.findByRole('region', { name: 'Belum masuk' })
    expect(within(reminder).getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/masuk')

    h.runSync.mockResolvedValue(undefined)
    await act(async () => { h.listener!('SIGNED_IN') })

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Belum masuk' })).toBeNull())
  })

  it('does not show it when the sync merely failed for lack of network', async () => {
    h.runSync.mockRejectedValueOnce(new Error('Failed to fetch'))
    render(<App />)
    await screen.findByText(/^Belum tersinkron/)

    expect(screen.queryByRole('region', { name: 'Belum masuk' })).toBeNull()
  })

  it.each(['/kasir', '/masuk'])('stays out of the way on %s', async path => {
    window.history.pushState({}, '', path)
    h.runSync.mockRejectedValue(new BelumMasukError())
    render(<App />)
    await screen.findByText(/^Belum masuk/) // the status is "not signed in", yet no banner here

    expect(screen.queryByRole('region', { name: 'Belum masuk' })).toBeNull()
  })
})
