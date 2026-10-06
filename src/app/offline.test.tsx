import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App'
import { supabaseTransport } from '../data/sync'

// The whole point of local-first: the app must mount with no network at all.
vi.mock('../data/sync', async () => ({
  ...(await vi.importActual<object>('../data/sync')),
  supabaseTransport: {
    push: vi.fn(async () => { throw new Error('offline') }),
    pull: vi.fn(async () => { throw new Error('offline') }),
  },
}))

// These tests simulate a configured shop whose network is down. Without this
// the test environment has no .env, which the app (correctly) treats as
// local-only and never attempts a sync at all.
vi.mock('../data/supabase', async () => ({
  ...(await vi.importActual<object>('../data/supabase')),
  isSupabaseConfigured: true,
}))

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom's window.location/history is a single global that otherwise leaks
  // across tests in this file: a prior test's navigation would make a later
  // test start already on that URL, which could make a broken navigation
  // handler look like it worked. Reset to the root before every test.
  window.history.pushState({}, '', '/')
})

describe('offline boot', () => {
  it('tells a not-signed-in owner that nothing is backed up, instead of the vaguer "not synced"', async () => {
    const { BelumMasukError } = await import('../data/sync')
    vi.mocked(supabaseTransport.push).mockRejectedValueOnce(new BelumMasukError())
    vi.mocked(supabaseTransport.pull).mockRejectedValueOnce(new BelumMasukError())
    render(<App />)
    expect(await screen.findByText('Belum masuk · 0 belum tercadangkan')).toBeInTheDocument()
  })

  it('renders the shell even though sync fails', async () => {
    render(<App />)
    expect(await screen.findByText('Toko Bahan Bangunan')).toBeInTheDocument()
    // Both Sidebar and BottomNav stay mounted (CSS hides one per breakpoint,
    // see the dedicated test below), so between them there are two distinct
    // "start a sale" controls: Sidebar's labeled "+ Transaksi baru", the
    // phone FAB labeled "Kasir · transaksi baru" (an aria-label, no visible "+").
    expect(screen.getByRole('button', { name: '+ Transaksi baru' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kasir · transaksi baru' })).toBeInTheDocument()
  })

  it('reports the unsynced state rather than crashing', async () => {
    render(<App />)
    // A role="status" region exists at every SyncStatus value, so asserting
    // only its presence would pass even if the catch path reported the wrong
    // state (or never updated past the initial 'menyimpan'). Assert the text
    // the failure path actually produces instead. The pending count is
    // deterministic here: no event was ever appended to the fake-indexeddb
    // instance backing this file's App renders, so getUnsyncedEvents()
    // always resolves to an empty array and SyncIndicator reports "(0)".
    expect(await screen.findByText('Belum tersinkron (0)')).toBeInTheDocument()
  })

  it('keeps both the desktop sidebar and the phone bottom nav mounted at once', async () => {
    render(<App />)
    await screen.findByText('Toko Bahan Bangunan')

    // By name, not by landmark: which <header>s count as a banner shifts while
    // the lazy page is still loading, but only the Sidebar owns a button with this name.
    const desktopButton = screen.getByRole('button', { name: '+ Transaksi baru' })
    expect(desktopButton).toBeInTheDocument()

    // aria-label uniquely identifies the phone nav regardless of CSS
    // visibility, the same role both bars' own <nav> elements otherwise
    // share. Multiple <nav> landmarks on one page are expected to carry
    // distinct accessible names (WCAG technique ARIA11); this labels each
    // one honestly rather than repurposing a phone-only link as an
    // incidental test hook the way the old "Lainnya" link used to be.
    const phoneNav = screen.getByRole('navigation', { name: 'Navigasi telepon' })
    const phoneFab = within(phoneNav).getByRole('button', { name: 'Kasir · transaksi baru' })
    expect(phoneFab).toBeInTheDocument()
    expect(phoneFab).not.toBe(desktopButton)
  })

  const pullCalls = () => vi.mocked(supabaseTransport.pull).mock.calls.length

  // Without a re-sync trigger, runSync ran exactly once per page load: a
  // device that was offline at launch stayed unsynced until the owner
  // happened to reload, which on an installed PWA left open all day may be
  // never.
  it('syncs again when the connection comes back, without a reload', async () => {
    render(<App />)
    await screen.findByText('Belum tersinkron (0)')
    const callsAfterMount = pullCalls()
    expect(callsAfterMount).toBeGreaterThan(0)

    window.dispatchEvent(new Event('online'))

    await vi.waitFor(() => expect(pullCalls()).toBeGreaterThan(callsAfterMount))
  })

  it('stops listening for the connection once unmounted, so the listener cannot leak', async () => {
    const { unmount } = render(<App />)
    await screen.findByText('Belum tersinkron (0)')

    // Trigger once while still mounted first. runSync does asynchronous
    // IndexedDB work before it ever reaches the transport, so asserting
    // "nothing happened" after a single microtask would pass even against a
    // leaked listener. This half proves the listener is live and that the
    // wait below is long enough for a leak to show itself.
    const beforeTrigger = pullCalls()
    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(pullCalls()).toBeGreaterThan(beforeTrigger))

    unmount()
    const callsAtUnmount = pullCalls()
    window.dispatchEvent(new Event('online'))
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(pullCalls()).toBe(callsAtUnmount)
  })

  // window.history.pushState alone bypasses react-router's history
  // listeners, so <Routes> never re-renders even though the address bar
  // changes. Asserting on window.location would pass against that broken
  // behavior; asserting the Kasir pane is actually visible would not.
  it('actually shows the Kasir pane when F2 is pressed, not just a URL change', async () => {
    render(<App />)
    await screen.findByText('Toko Bahan Bangunan')
    expect(screen.queryByRole('heading', { name: 'Kasir' })).toBeNull()

    await userEvent.keyboard('{F2}')

    expect(await screen.findByRole('heading', { name: 'Kasir' })).toBeInTheDocument()
  })

  // The F2 listener moved here from the deleted TopNav.tsx verbatim (same
  // effect body, same dependency array), but its own two robustness tests
  // did not move with it when TopNav.test.tsx was deleted: nothing in the
  // suite proved that a regression in this listener's focus-independence or
  // cleanup would still be caught. Restoring that coverage at its new home.
  it('still triggers F2 when focus sits on an unrelated element elsewhere on the page', async () => {
    render(<App />)
    await screen.findByText('Toko Bahan Bangunan')

    // Tab to whatever the shell's first real focusable element is (the
    // Sidebar's own CTA or nav links), rather than assuming a specific
    // field exists on the default Beranda route. Any focused element other
    // than the page body proves focus moved somewhere before F2 fires.
    await userEvent.tab()
    expect(document.activeElement).not.toBe(document.body)

    await userEvent.keyboard('{F2}')

    expect(await screen.findByRole('heading', { name: 'Kasir' })).toBeInTheDocument()
  })

  it('stops listening for F2 once unmounted, so it cannot fire twice after the app is torn down', async () => {
    // App.tsx builds its own navigate callback internally (via
    // useNavigate()), unlike the deleted TopNav, which took onNewTransaction
    // as an external prop a test could spy on directly. With no equivalent
    // injection point here, spying on window.removeEventListener - the same
    // technique the project's own phase-1 handoff notes recommend for this
    // exact class of test ("a timing threshold, not a structural one...
    // spy on removeEventListener instead") - proves the effect's cleanup
    // function actually ran, rather than inferring it from timing or a
    // thrown error.
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<App />)
    await screen.findByText('Toko Bahan Bangunan')

    unmount()

    const removedKeydown = removeSpy.mock.calls.some(([type]) => type === 'keydown')
    expect(removedKeydown).toBe(true)
    removeSpy.mockRestore()
  })

  it('actually shows the Kasir pane when the desktop Transaksi baru button is clicked', async () => {
    render(<App />)
    await screen.findByText('Toko Bahan Bangunan')

    const desktopButton = within(screen.getByRole('banner')).getByRole(
      'button',
      { name: '+ Transaksi baru' },
    )
    await userEvent.click(desktopButton)

    expect(await screen.findByRole('heading', { name: 'Kasir' })).toBeInTheDocument()
  })
})
