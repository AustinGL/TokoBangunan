import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { BarangSheet } from './BarangSheet'

const stamp = { updatedAt: '2026-09-30T00:00:00.000Z', updatedByEventId: 'e' }
beforeEach(async () => { await db.delete(); await db.open() })

describe('BarangSheet: create', () => {
  it('submits nama and the chosen kategori id, defaulting diarsipkan to false', async () => {
    await db.kategoriProj.put({ id: 'kat_a', nama: 'Semen', diarsipkan: false, ...stamp })
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<BarangSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/nama barang/i), 'Semen Tiga Roda')
    await user.click(await screen.findByRole('combobox', { name: 'Kategori' }))
    await user.click(screen.getByRole('option', { name: 'Semen' }))
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Semen Tiga Roda', kategoriId: 'kat_a', diarsipkan: false })
  })

  it('rejects an empty nama', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<BarangSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/nama barang wajib diisi/i)).toBeInTheDocument()
  })
})

describe('BarangSheet: edit', () => {
  it('pre-fills from initialValues and submits the edited state', async () => {
    await db.kategoriProj.put({ id: 'kat_a', nama: 'Semen', diarsipkan: false, ...stamp })
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <BarangSheet
        open onClose={vi.fn()} onSubmit={onSubmit}
        initialValues={{ nama: 'Semen Tiga Roda', kategoriId: 'kat_a', diarsipkan: false }}
      />,
    )

    const namaField = screen.getByLabelText(/nama barang/i)
    await user.clear(namaField)
    await user.type(namaField, 'Semen Tiga Roda 50kg')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(screen.getByRole('combobox', { name: 'Kategori' })).toHaveValue('Semen')
    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Semen Tiga Roda 50kg', kategoriId: 'kat_a', diarsipkan: false })
  })

  it('keeps an archived kategori selected when saving an unchanged edit', async () => {
    await db.kategoriProj.put({ id: 'kat_old', nama: 'Kategori Lama', diarsipkan: true, ...stamp })
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<BarangSheet open onClose={vi.fn()} onSubmit={onSubmit} initialValues={{ nama: 'Palu', kategoriId: 'kat_old', diarsipkan: false }} />)

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Kategori' })).toHaveValue('Kategori Lama'))
    await user.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Palu', kategoriId: 'kat_old', diarsipkan: false })
  })

  it('can clear the kategori with Tanpa kategori', async () => {
    await db.kategoriProj.put({ id: 'kat_a', nama: 'Semen', diarsipkan: false, ...stamp })
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<BarangSheet open onClose={vi.fn()} onSubmit={onSubmit} initialValues={{ nama: 'Palu', kategoriId: 'kat_a', diarsipkan: false }} />)

    await user.click(await screen.findByRole('combobox', { name: 'Kategori' }))
    await user.click(screen.getByRole('option', { name: 'Tanpa kategori' }))
    await user.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Palu', kategoriId: null, diarsipkan: false })
  })

  it('archives via the diarsipkan checkbox', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <BarangSheet
        open onClose={vi.fn()} onSubmit={onSubmit}
        initialValues={{ nama: 'Semen Tiga Roda', diarsipkan: false }}
      />,
    )

    await user.click(screen.getByLabelText(/arsipkan/i))
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ diarsipkan: true }))
  })
})

describe('BarangSheet: prefill from a typed search', () => {
  it('prefills nama from initialNama on a fresh create', () => {
    render(<BarangSheet open onClose={vi.fn()} onSubmit={vi.fn()} initialNama="Paku Beton" />)

    expect(screen.getByLabelText('Nama barang')).toHaveValue('Paku Beton')
  })
})

describe('BarangSheet: submit failure', () => {
  it('shows a visible error instead of failing silently when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('IndexedDB quota exceeded'))
    const user = userEvent.setup()
    render(<BarangSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/nama barang/i), 'Semen Tiga Roda')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
  })
})

describe('BarangSheet: edit-only fields', () => {
  it('shows Arsipkan only when editing a barang that already exists', () => {
    const { unmount } = render(<BarangSheet open onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.queryByLabelText('Arsipkan')).toBeNull()
    unmount()

    render(<BarangSheet open onClose={vi.fn()} onSubmit={vi.fn()} initialValues={{ nama: 'Semen', diarsipkan: false }} />)
    expect(screen.getByLabelText('Arsipkan')).toBeInTheDocument()
  })
})

describe('BarangSheet: footer', () => {
  it('keeps the save button inside a sticky footer', () => {
    render(<BarangSheet open onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Simpan' }).parentElement).toHaveClass('sticky', 'bottom-0')
  })
})
