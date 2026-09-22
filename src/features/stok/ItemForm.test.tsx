import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ItemForm } from './ItemForm'

const fillValid = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/nama barang/i), 'Semen Tiga Roda')
  await user.type(screen.getByLabelText(/satuan dasar/i), 'sak')
  await user.type(screen.getByLabelText(/harga eceran/i), '52000')
  await user.type(screen.getByLabelText(/stok minimum/i), '10')
}

describe('ItemForm', () => {
  it('renders all required fields with visible labels', () => {
    render(<ItemForm onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/nama barang/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/satuan dasar/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/harga eceran/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/stok minimum/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/stok awal/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/barcode/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kategori/i)).toBeInTheDocument()
  })

  it('shows an inline error under nama, wired via aria-describedby, when nama is empty', async () => {
    const user = userEvent.setup()
    render(<ItemForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText(/satuan dasar/i), 'sak')
    await user.type(screen.getByLabelText(/harga eceran/i), '52000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    const namaInput = screen.getByLabelText(/nama barang/i)
    const describedBy = namaInput.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent(/wajib diisi/i)
  })

  it('shows the focusable error summary and moves focus to it when two or more fields are invalid', async () => {
    const user = userEvent.setup()
    render(<ItemForm onSubmit={vi.fn()} />)

    // nama and satuan dasar both left empty: two failing required fields.
    await user.type(screen.getByLabelText(/harga eceran/i), '52000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    const summary = screen.getByRole('alert')
    expect(summary).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(summary)
  })

  it('does not show the summary when exactly one field is invalid', async () => {
    const user = userEvent.setup()
    render(<ItemForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText(/satuan dasar/i), 'sak')
    await user.type(screen.getByLabelText(/harga eceran/i), '52000')
    await user.type(screen.getByLabelText(/stok minimum/i), '10')
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    expect(screen.queryByRole('alert')).toBeNull()
    const namaInput = screen.getByLabelText(/nama barang/i)
    expect(namaInput.getAttribute('aria-describedby')).toBeTruthy()
  })

  it('calls onSubmit with the exact validated values, including stokAwal when provided', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ItemForm onSubmit={onSubmit} />)

    await fillValid(user)
    await user.type(screen.getByLabelText(/stok awal/i), '50')
    await user.type(screen.getByLabelText(/barcode/i), '899123456')
    await user.type(screen.getByLabelText(/kategori/i), 'Semen')
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      nama: 'Semen Tiga Roda',
      baseUnit: 'sak',
      hargaEceran: 52000,
      stokMinimum: 10,
      stokAwal: 50,
      barcode: '899123456',
      kategori: 'Semen',
    })
  })

  it('calls onSubmit with stokAwal, barcode and kategori omitted when left blank', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ItemForm onSubmit={onSubmit} />)

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      nama: 'Semen Tiga Roda',
      baseUnit: 'sak',
      hargaEceran: 52000,
      stokMinimum: 10,
      stokAwal: undefined,
      barcode: undefined,
      kategori: undefined,
    })
  })

  it('gives the primary submit button the 44px minimum height utility class', () => {
    render(<ItemForm onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /simpan barang/i })).toHaveClass('min-h-tap')
  })

  it('shows a focusable, visible error and keeps the entered values when onSubmit rejects', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockRejectedValue(new Error('write failed'))
    render(<ItemForm onSubmit={onSubmit} />)

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/gagal disimpan/i)
    expect(alert).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(alert)
    // The form itself is untouched: nothing was cleared, no crash from the
    // unhandled rejection.
    expect(screen.getByLabelText(/nama barang/i)).toHaveValue('Semen Tiga Roda')
  })

  it('disables the submit button while a submission is in flight', async () => {
    const user = userEvent.setup()
    let resolveSubmit: () => void = () => {}
    const onSubmit = vi.fn(() => new Promise<void>(resolve => { resolveSubmit = resolve }))
    render(<ItemForm onSubmit={onSubmit} />)

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: /simpan barang/i }))

    expect(screen.getByRole('button', { name: /menyimpan/i })).toBeDisabled()
    resolveSubmit()
  })
})
