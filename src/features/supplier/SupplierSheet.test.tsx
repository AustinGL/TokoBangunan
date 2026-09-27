import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SupplierSheet } from './SupplierSheet'

describe('SupplierSheet: create', () => {
  it('submits nama alone when the optional fields are left blank', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<SupplierSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/^nama/i), 'CV Maju')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).toHaveBeenCalledWith({ nama: 'CV Maju', telepon: null, alamat: null, kontak: null, catatan: null })
  })

  it('rejects an empty nama', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<SupplierSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/nama.*wajib diisi/i)).toBeInTheDocument()
  })
})

describe('SupplierSheet: edit', () => {
  it('pre-fills from initialValues', () => {
    render(
      <SupplierSheet
        open onClose={vi.fn()} onSubmit={vi.fn()}
        initialValues={{ nama: 'CV Maju', telepon: '0812' }}
      />,
    )
    expect(screen.getByLabelText(/^nama/i)).toHaveValue('CV Maju')
    expect(screen.getByLabelText(/telepon/i)).toHaveValue('0812')
  })

  it('shows a visible error instead of failing silently when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Supplier tidak ditemukan.'))
    const user = userEvent.setup()
    render(<SupplierSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/^nama/i), 'CV Maju')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
  })

  it('renders riwayat pembelian rows when given, showing a readable name rather than a raw id', () => {
    render(
      <SupplierSheet
        open onClose={vi.fn()} onSubmit={vi.fn()}
        initialValues={{ nama: 'CV Maju' }}
        riwayat={[{ batchId: 'b1', tanggalBeli: '2026-09-15T00:00:00.000Z', nama: 'Semen Tiga Roda · 50 kg' }]}
      />,
    )
    expect(screen.getByText(/riwayat pembelian/i)).toBeInTheDocument()
    expect(screen.getByText(/semen tiga roda · 50 kg/i)).toBeInTheDocument()
  })
})
