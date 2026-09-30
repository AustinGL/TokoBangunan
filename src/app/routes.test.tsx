import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../data/db'
import { ToastProvider } from '../ui/Toast'
import { AppRoutes } from './routes'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

// /kasir used to render a placeholder (no Kasir screen existed until Task
// 6). Task 6b wires the real screen in, so this now asserts the live Kasir
// UI mounts, not the "dibangun di fase berikutnya" placeholder copy.
describe('AppRoutes: the /kasir route and the catch-all', () => {
  it('renders the real Kasir screen for /kasir, not the placeholder', () => {
    render(
      <MemoryRouter initialEntries={['/kasir']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Kasir' })).toBeInTheDocument()
    expect(screen.getByLabelText(/cari barang/i)).toBeInTheDocument()
    expect(screen.queryByText('Layar ini dibangun di fase berikutnya.')).toBeNull()
  })

  // The catch-all used to serve double duty as the Kasir landing pane,
  // which meant a typo'd URL, a stale bookmark, or any future dead link
  // would render a heading that reads "Kasir" - actively wrong information,
  // not just a blank pane. /kasir now has its own explicit route, so the
  // wildcard route below should only ever render honest not-found copy.
  it('does not mislabel a genuinely unmatched path as Kasir', () => {
    render(
      <MemoryRouter initialEntries={['/tidak-ada']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.queryByText('Kasir')).toBeNull()
    expect(screen.getByText('Halaman tidak ditemukan')).toBeInTheDocument()
  })
})

describe('AppRoutes: the /stok route', () => {
  it('renders the new Stok list screen for /stok, not the legacy ItemList', () => {
    render(
      <MemoryRouter initialEntries={['/stok']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Stok' })).toBeInTheDocument()
    // The legacy ItemList screen's own "+ Tambah barang" inline-form button
    // has no equivalent in the new Stok screen, which renders a disabled
    // "+ Tambah stok" instead - this is a straightforward, honest way to
    // assert this is the new screen, not the old one.
    expect(screen.queryByRole('button', { name: '+ Tambah barang' })).toBeNull()
  })
})

describe('AppRoutes: /lainnya redirects home (the sheet replaces the old route)', () => {
  it('redirects a legacy /lainnya bookmark to Beranda rather than 404ing it', () => {
    render(
      <MemoryRouter initialEntries={['/lainnya']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Beranda' })).toBeInTheDocument()
    expect(screen.queryByText('Halaman tidak ditemukan')).toBeNull()
  })
})

describe('AppRoutes: the /masuk route', () => {
  it('renders the account screen for /masuk, not the not-found page', async () => {
    render(
      <MemoryRouter initialEntries={['/masuk']}>
        <ToastProvider><AppRoutes /></ToastProvider>
      </MemoryRouter>,
    )

    // "Akun" while the device session loads, then "Masuk" (or "Akun" again when a
    // cloud project is not configured for this run): the heading element is
    // replaced between those states, so wait on the condition, not on one element.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: /^(Masuk|Akun)$/ })).toBeInTheDocument())
    expect(screen.queryByText('Halaman tidak ditemukan')).toBeNull()
  })
})
