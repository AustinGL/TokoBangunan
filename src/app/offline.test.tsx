import 'fake-indexeddb/auto'
import { render, screen, within } from '@testing-library/react'
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

beforeEach(() => vi.clearAllMocks())

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
    expect(await screen.findByRole('status')).toBeInTheDocument()
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
})
