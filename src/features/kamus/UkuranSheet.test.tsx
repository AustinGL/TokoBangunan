import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { UkuranSheet } from './UkuranSheet'

const barangOptions = [{ barangId: 'b1', nama: 'Semen Tiga Roda' }, { barangId: 'b2', nama: 'Semen Gudang Garam' }]

describe('UkuranSheet: create', () => {
  it('submits ukuran, hargaEceran and stokMinimum as numbers', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<UkuranSheet open onClose={vi.fn()} onSubmit={onSubmit} barangOptions={barangOptions} currentBarangId="b1" />)

    await user.type(screen.getByLabelText(/^ukuran$/i), '50 kg')
    await user.type(screen.getByLabelText(/harga eceran/i), '65000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10 }))
  })

  it('rejects an empty ukuran', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<UkuranSheet open onClose={vi.fn()} onSubmit={onSubmit} barangOptions={barangOptions} currentBarangId="b1" />)

    await user.type(screen.getByLabelText(/harga eceran/i), '65000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/ukuran wajib diisi/i)).toBeInTheDocument()
  })
})

describe('UkuranSheet: move to another barang', () => {
  it('submits the newly selected barangId', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <UkuranSheet
        open onClose={vi.fn()} onSubmit={onSubmit} barangOptions={barangOptions} currentBarangId="b1"
        initialValues={{ ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10, diarsipkan: false }}
      />,
    )

    await user.selectOptions(screen.getByLabelText(/pindahkan ke barang lain/i), 'b2')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ barangId: 'b2' }))
  })
})

describe('UkuranSheet: submit failure', () => {
  it('shows a visible error instead of failing silently when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Barang tidak ditemukan.'))
    const user = userEvent.setup()
    render(<UkuranSheet open onClose={vi.fn()} onSubmit={onSubmit} barangOptions={barangOptions} currentBarangId="b1" />)

    await user.type(screen.getByLabelText(/^ukuran$/i), '50 kg')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
  })
})

describe('UkuranSheet: number validation', () => {
  it('rejects a negative harga eceran rather than silently storing it', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<UkuranSheet open onClose={vi.fn()} onSubmit={onSubmit} barangOptions={barangOptions} currentBarangId="b1" />)

    await user.type(screen.getByLabelText(/^ukuran$/i), '50 kg')
    await user.type(screen.getByLabelText(/harga eceran/i), '-5000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/harga eceran.*bilangan bulat, minimal 0/i)).toBeInTheDocument()
  })
})
