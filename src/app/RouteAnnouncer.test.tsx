import { useEffect, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { RouteAnnouncer } from './RouteAnnouncer'
import { pageTitleFor } from './pageTitle'

beforeEach(() => { document.title = 'awal' })

function Shell() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Link to="/">home</Link>
      <Link to="/stok">to stok</Link>
      <Link to="/kasir">to kasir</Link>
      <Routes>
        <Route path="/" element={<main><h1>Beranda</h1></main>} />
        <Route path="/stok" element={<main><h1>Stok</h1></main>} />
        <Route path="/kasir" element={<main><h1>Kasir</h1><input aria-label="Cari barang" autoFocus /></main>} />
      </Routes>
      <RouteAnnouncer />
    </MemoryRouter>
  )
}

describe('pageTitleFor', () => {
  it('names the screen, then the app', () => {
    expect(pageTitleFor('Stok')).toBe('Stok · Toko Bahan Bangunan')
  })
  it('falls back to the app name when the page has no heading', () => {
    expect(pageTitleFor(null)).toBe('Toko Bahan Bangunan')
    expect(pageTitleFor('   ')).toBe('Toko Bahan Bangunan')
  })
})

describe('RouteAnnouncer', () => {
  it('sets the document title from the screen heading, on first load and after navigating', async () => {
    const user = userEvent.setup()
    render(<Shell />)
    await waitFor(() => expect(document.title).toBe('Beranda · Toko Bahan Bangunan'))

    await user.click(screen.getByText('to stok'))

    await waitFor(() => expect(document.title).toBe('Stok · Toko Bahan Bangunan'))
  })

  it('moves focus to the new screen heading after a navigation, so it is read out', async () => {
    const user = userEvent.setup()
    render(<Shell />)
    await user.click(screen.getByText('to stok'))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Stok' })).toHaveFocus())
  })

  it('does not steal focus from a field the page already focused (Kasir search must stay ready for a scanner)', async () => {
    const user = userEvent.setup()
    render(<Shell />)
    await user.click(screen.getByText('to kasir'))

    await waitFor(() => expect(document.title).toBe('Kasir · Toko Bahan Bangunan'))
    expect(screen.getByLabelText('Cari barang')).toHaveFocus()
  })

  it('waits for a heading that renders after a loading state, then titles and focuses it', async () => {
    const user = userEvent.setup()
    function Late() {
      const [ready, setReady] = useState(false)
      useEffect(() => { const id = setTimeout(() => setReady(true), 60); return () => clearTimeout(id) }, [])
      return <main>{ready ? <h1>Detail stok</h1> : <p>Memuat...</p>}</main>
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Link to="/late">to late</Link>
        <Routes>
          <Route path="/" element={<main><h1>Beranda</h1></main>} />
          <Route path="/late" element={<Late />} />
        </Routes>
        <RouteAnnouncer />
      </MemoryRouter>,
    )
    await user.click(screen.getByText('to late'))

    await waitFor(() => expect(document.title).toBe('Detail stok · Toko Bahan Bangunan'))
    expect(screen.getByRole('heading', { name: 'Detail stok' })).toHaveFocus()
  })

  it('leaves focus alone on the very first load', async () => {
    render(<Shell />)
    await waitFor(() => expect(document.title).toBe('Beranda · Toko Bahan Bangunan'))
    expect(document.body).toHaveFocus()
  })
})
