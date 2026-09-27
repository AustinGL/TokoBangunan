import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BarangSheet } from './BarangSheet'

describe('BarangSheet: create', () => {
  it('submits nama and kategori, defaulting diarsipkan to false', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<BarangSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/nama barang/i), 'Semen Tiga Roda')
    await user.type(screen.getByLabelText(/kategori/i), 'Semen')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Semen Tiga Roda', kategori: 'Semen', diarsipkan: false })
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
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <BarangSheet
        open onClose={vi.fn()} onSubmit={onSubmit}
        initialValues={{ nama: 'Semen Tiga Roda', kategori: 'Semen', diarsipkan: false }}
      />,
    )

    const namaField = screen.getByLabelText(/nama barang/i)
    await user.clear(namaField)
    await user.type(namaField, 'Semen Tiga Roda 50kg')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Semen Tiga Roda 50kg', kategori: 'Semen', diarsipkan: false })
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
