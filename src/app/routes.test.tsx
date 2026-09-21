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
})
