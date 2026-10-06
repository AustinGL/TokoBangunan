import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { NamaTokoSheet } from './NamaTokoSheet'

describe('NamaTokoSheet', () => {
  it('opens as "Nama toko", prefilled, with the hint about leaving it empty', () => {
    render(<NamaTokoSheet open onClose={vi.fn()} namaAwal="Toko Maju" onSubmit={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Nama toko' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nama toko' })).toHaveValue('Toko Maju')
    expect(screen.getByText('Kosongkan untuk tidak menyebut nama toko.')).toBeInTheDocument()
  })

  it('submits the trimmed name', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<NamaTokoSheet open onClose={vi.fn()} namaAwal="" onSubmit={onSubmit} />)

    await user.type(screen.getByRole('textbox', { name: 'Nama toko' }), '  Toko Baru  ')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(onSubmit).toHaveBeenCalledWith('Toko Baru')
  })

  it('an empty name is allowed: it clears the name', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<NamaTokoSheet open onClose={vi.fn()} namaAwal="Toko Maju" onSubmit={onSubmit} />)

    await user.clear(screen.getByRole('textbox', { name: 'Nama toko' }))
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    expect(onSubmit).toHaveBeenCalledWith('')
  })

  it('does not take more than 60 characters', async () => {
    const user = userEvent.setup()
    render(<NamaTokoSheet open onClose={vi.fn()} namaAwal="" onSubmit={vi.fn()} />)
    await user.type(screen.getByRole('textbox', { name: 'Nama toko' }), 'x'.repeat(70))
    expect((screen.getByRole('textbox', { name: 'Nama toko' }) as HTMLInputElement).value).toHaveLength(60)
  })

  it('shows a visible error when saving fails', async () => {
    const user = userEvent.setup()
    render(<NamaTokoSheet open onClose={vi.fn()} namaAwal="" onSubmit={vi.fn().mockRejectedValue(new Error('x'))} />)
    await user.type(screen.getByRole('textbox', { name: 'Nama toko' }), 'Toko')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nama toko gagal disimpan. Coba lagi.')
  })
})
