import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../data/db'
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

// Flow spec section 4: "Lainnya holds: Transaksi, Supplier, Laporan." On a
// phone, BottomNav's "Lainnya" tab used to land on a placeholder with no
// links at all, leaving Transaksi unreachable without typing the URL.
describe('AppRoutes: /lainnya links to Transaksi, Supplier, and Laporan', () => {
  it('renders real links to all three destinations', () => {
    render(
      <MemoryRouter initialEntries={['/lainnya']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Transaksi' })).toHaveAttribute('href', '/transaksi')
    expect(screen.getByRole('link', { name: 'Supplier' })).toHaveAttribute('href', '/supplier')
    expect(screen.getByRole('link', { name: 'Laporan' })).toHaveAttribute('href', '/laporan')
  })

  it('the Transaksi link actually navigates to the real Transaksi screen', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/lainnya']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('link', { name: 'Transaksi' }))

    expect(screen.getByRole('heading', { name: 'Transaksi' })).toBeInTheDocument()
  })
})
