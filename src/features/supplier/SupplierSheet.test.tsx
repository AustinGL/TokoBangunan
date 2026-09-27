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

  it('renders riwayat pembelian rows when given', () => {
    render(
      <SupplierSheet
        open onClose={vi.fn()} onSubmit={vi.fn()}
        initialValues={{ nama: 'CV Maju' }}
        riwayat={[{ batchId: 'b1', tanggalBeli: '2026-09-15T00:00:00.000Z', itemId: 'semen' }]}
      />,
    )
    expect(screen.getByText(/riwayat pembelian/i)).toBeInTheDocument()
  })
})
