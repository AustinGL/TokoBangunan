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

    await user.click(screen.getByRole('combobox', { name: /pindahkan ke barang lain/i }))
    await user.click(screen.getByRole('option', { name: 'Semen Gudang Garam' }))
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
    await user.type(screen.getByLabelText(/harga eceran/i), '65000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal disimpan/i)
  })
})

describe('UkuranSheet: prefill from an unknown scan', () => {
  it('prefills barcode from initialBarcode on a fresh create', () => {
    render(
      <UkuranSheet
        open onClose={vi.fn()} onSubmit={vi.fn()}
        barangOptions={[{ barangId: 'b1', nama: 'Semen Tiga Roda' }]} currentBarangId="b1"
        initialBarcode="9990001112223"
      />,
    )

    expect(screen.getByLabelText('Barcode')).toHaveValue('9990001112223')
  })
})

describe('UkuranSheet: number validation', () => {
  it('cannot hold a negative harga eceran at all: the Rupiah field drops any character that is not a digit', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<UkuranSheet open onClose={vi.fn()} onSubmit={onSubmit} barangOptions={barangOptions} currentBarangId="b1" />)

    await user.type(screen.getByLabelText(/^ukuran$/i), '50 kg')
    await user.type(screen.getByLabelText(/harga eceran/i), '-5000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')

    expect(screen.getByLabelText(/harga eceran/i)).toHaveValue('5.000')
    await user.click(screen.getByRole('button', { name: /simpan/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ hargaEceran: 5000 }))
  })

  it('asks for harga eceran when it is left empty', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<UkuranSheet open onClose={vi.fn()} onSubmit={onSubmit} barangOptions={barangOptions} currentBarangId="b1" />)

    await user.type(screen.getByLabelText(/^ukuran$/i), '50 kg')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Harga eceran wajib diisi.')).toBeInTheDocument()
  })

  it('asks for stok minimum when it is left empty, instead of silently turning it into 0 (no low-stock alert ever)', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<UkuranSheet open onClose={vi.fn()} onSubmit={onSubmit} barangOptions={barangOptions} currentBarangId="b1" />)

    await user.type(screen.getByLabelText(/^ukuran$/i), '50 kg')
    await user.type(screen.getByLabelText(/harga eceran/i), '65000')
    await user.click(screen.getByRole('button', { name: /simpan/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Stok minimum wajib diisi.')).toBeInTheDocument()
  })

  it('shows Pindahkan and Arsipkan only when editing an ukuran that already exists', () => {
    const { unmount } = render(<UkuranSheet open onClose={vi.fn()} onSubmit={vi.fn()} barangOptions={barangOptions} currentBarangId="b1" />)
    expect(screen.queryByLabelText(/pindahkan ke barang lain/i)).toBeNull()
    expect(screen.queryByLabelText('Arsipkan')).toBeNull()
    unmount()

    render(
      <UkuranSheet
        open onClose={vi.fn()} onSubmit={vi.fn()} barangOptions={barangOptions} currentBarangId="b1"
        initialValues={{ ukuran: '50 kg', hargaEceran: 65000, stokMinimum: 10, diarsipkan: false }}
      />,
    )
    expect(screen.getByLabelText(/pindahkan ke barang lain/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Arsipkan')).toBeInTheDocument()
  })

  it('marks the required fields with a visible star without changing their accessible names', () => {
    render(<UkuranSheet open onClose={vi.fn()} onSubmit={vi.fn()} barangOptions={barangOptions} currentBarangId="b1" />)
    expect(screen.getByLabelText(/^ukuran$/i)).toBeInTheDocument()
    expect(screen.getByText('Ukuran').classList.contains('req')).toBe(true)
    expect(screen.getByLabelText(/harga eceran/i)).toHaveAttribute('aria-required', 'true')
  })
})
