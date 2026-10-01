import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { KategoriSheet } from './KategoriSheet'

describe('KategoriSheet', () => {
  it('is titled "Kategori baru" for a create and has no archive checkbox', () => {
    render(<KategoriSheet open onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Kategori baru' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Arsipkan')).not.toBeInTheDocument()
  })

  it('is titled "Ubah kategori" for an edit, with the archive checkbox', () => {
    render(<KategoriSheet open onClose={vi.fn()} onSubmit={vi.fn()} initialValues={{ nama: 'Semen', diarsipkan: false }} />)
    expect(screen.getByRole('dialog', { name: 'Ubah kategori' })).toBeInTheDocument()
    expect(screen.getByLabelText('Arsipkan')).not.toBeChecked()
  })

  it('requires a name and focuses the invalid field', async () => {
    const onSubmit = vi.fn()
    render(<KategoriSheet open onClose={vi.fn()} onSubmit={onSubmit} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Simpan' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Nama kategori wajib diisi.')
    expect(screen.getByLabelText(/Nama kategori/)).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the trimmed name', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<KategoriSheet open onClose={vi.fn()} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/Nama kategori/), '  Semen ')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(onSubmit).toHaveBeenCalledWith({ nama: 'Semen', diarsipkan: false })
  })

  it('shows the message of a rejected save inside the sheet', async () => {
    const user = userEvent.setup()
    render(<KategoriSheet open onClose={vi.fn()} onSubmit={vi.fn().mockRejectedValue(new Error('Nama kategori sudah dipakai.'))} />)
    await user.type(screen.getByLabelText(/Nama kategori/), 'Semen')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nama kategori sudah dipakai.')
  })

  it('keeps its Simpan button in the sticky footer', () => {
    render(<KategoriSheet open onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Simpan' }).parentElement).toHaveClass('sticky', 'bottom-0')
  })
})
