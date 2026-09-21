import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App'

// The whole point of local-first: the app must mount with no network at all.
vi.mock('../data/sync', async () => ({
  ...(await vi.importActual<object>('../data/sync')),
  supabaseTransport: {
    push: vi.fn(async () => { throw new Error('offline') }),
    pull: vi.fn(async () => { throw new Error('offline') }),
  },
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
  it('renders the shell even though sync fails', async () => {
    render(<App />)
    expect(await screen.findByText('Toko Bahan Bangunan')).toBeInTheDocument()
    // Both TopNav and BottomNav stay mounted (CSS hides one per breakpoint,
    // see the dedicated test below), so both carry a "Transaksi baru" control.
    expect(screen.getAllByRole('button', { name: 'Transaksi baru' })).toHaveLength(2)
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

  // Load-bearing: TopNav owns the global F2 keydown listener. Every nav test
  // elsewhere mounts TopNav or BottomNav directly, so a JS conditional in App
  // that renders only one of them (instead of relying on CSS breakpoints to
  // hide/show) would break the F2 shortcut on phone width with a fully green
  // suite otherwise. This pins both navs into the DOM in the same render.
  it('keeps both the desktop nav and the phone nav mounted at once', async () => {
    render(<App />)
    await screen.findByText('Toko Bahan Bangunan')

    const desktopButton = within(screen.getByRole('banner')).getByRole(
      'button',
      { name: 'Transaksi baru' },
    )
    expect(desktopButton).toBeInTheDocument()

    // 'Lainnya' only exists in BottomNav's PHONE_ITEMS, so it uniquely
    // identifies the phone nav's <nav> element regardless of CSS visibility.
    const phoneOnlyLink = screen.getByRole('link', { name: 'Lainnya' })
    const phoneNav = phoneOnlyLink.closest('nav')
    expect(phoneNav).not.toBeNull()

    const phoneFab = within(phoneNav as HTMLElement).getByRole(
      'button',
      { name: 'Transaksi baru' },
    )
    expect(phoneFab).toBeInTheDocument()
    expect(phoneFab).not.toBe(desktopButton)
  })

  // window.history.pushState alone bypasses react-router's history
  // listeners, so <Routes> never re-renders even though the address bar
  // changes. Asserting on window.location would pass against that broken
  // behavior; asserting the Kasir pane is actually visible would not.
  it('actually shows the Kasir pane when F2 is pressed, not just a URL change', async () => {
    render(<App />)
    await screen.findByText('Toko Bahan Bangunan')
    expect(screen.queryByText('Kasir')).toBeNull()

    await userEvent.keyboard('{F2}')

    expect(await screen.findByText('Kasir')).toBeInTheDocument()
  })

  it('actually shows the Kasir pane when the desktop Transaksi baru button is clicked', async () => {
    render(<App />)
    await screen.findByText('Toko Bahan Bangunan')

    const desktopButton = within(screen.getByRole('banner')).getByRole(
      'button',
      { name: 'Transaksi baru' },
    )
    await userEvent.click(desktopButton)

    expect(await screen.findByText('Kasir')).toBeInTheDocument()
  })
})
