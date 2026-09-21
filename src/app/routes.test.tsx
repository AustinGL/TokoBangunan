import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { AppRoutes } from './routes'

// /kasir is where the F2 shortcut and the "Transaksi baru" buttons currently
// send the user (no Kasir screen exists until a later phase). Without a
// catch-all route, that navigation renders nothing at all under a live nav
// bar - the app's single most prominent action would land on a blank pane.
describe('AppRoutes catch-all', () => {
  it('renders a placeholder instead of a blank pane for /kasir', () => {
    render(
      <MemoryRouter initialEntries={['/kasir']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByText('Kasir')).toBeInTheDocument()
    expect(screen.getByText('Layar ini dibangun di fase berikutnya.')).toBeInTheDocument()
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
