import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PelangganSheet } from './PelangganSheet'

describe('PelangganSheet', () => {
  it('requires a nama and does not submit without one', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<PelangganSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(screen.getByText('Nama pelanggan wajib diisi.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits trimmed values, with blank optional fields as null', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<PelangganSheet open onClose={vi.fn()} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Nama'), '  Budi  ')
    await user.type(screen.getByLabelText('Telepon'), '0812')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Budi', telepon: '0812', alamat: null })
  })

  it('shows a visible error when saving fails', async () => {
    const user = userEvent.setup()
    render(<PelangganSheet open onClose={vi.fn()} onSubmit={vi.fn().mockRejectedValue(new Error('x'))} />)
    await user.type(screen.getByLabelText('Nama'), 'Budi')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Pelanggan gagal disimpan. Coba lagi.')
  })

  it('opens as "Pelanggan baru" with empty fields when there is nothing to edit', () => {
    render(<PelangganSheet open onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Pelanggan baru' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nama')).toHaveValue('')
  })

  it('edits: opens as "Ubah pelanggan" prefilled, and submits the changed phone with the rest kept', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<PelangganSheet open onClose={vi.fn()} onSubmit={onSubmit} initialValues={{ nama: 'Budi', alamat: 'Jl. Mawar 1' }} />)

    expect(screen.getByRole('dialog', { name: 'Ubah pelanggan' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nama')).toHaveValue('Budi')
    expect(screen.getByLabelText('Alamat')).toHaveValue('Jl. Mawar 1')
    expect(screen.getByLabelText('Telepon')).toHaveValue('')

    await user.type(screen.getByLabelText('Telepon'), '0812-5550-101')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Budi', telepon: '0812-5550-101', alamat: 'Jl. Mawar 1' })
  })

  it('shows a hint above the fields when given one', () => {
    render(<PelangganSheet open onClose={vi.fn()} onSubmit={vi.fn()} initialValues={{ nama: 'Budi' }} hint="Tambahkan nomor WhatsApp dulu." />)
    expect(screen.getByText('Tambahkan nomor WhatsApp dulu.')).toBeInTheDocument()
  })

  it('lets a phone number be cleared, submitting null', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<PelangganSheet open onClose={vi.fn()} onSubmit={onSubmit} initialValues={{ nama: 'Budi', telepon: '0812' }} />)

    await user.clear(screen.getByLabelText('Telepon'))
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Budi', telepon: null, alamat: null })
  })
})
