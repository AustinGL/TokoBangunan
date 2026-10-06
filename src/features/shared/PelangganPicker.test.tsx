import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { PelangganPicker } from './PelangganPicker'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('PelangganPicker', () => {
  it('lists customers, with the phone number as a hint', async () => {
    await db.customersProj.put({ id: 'c1', nama: 'Budi', telepon: '0812-555', tier: 'eceran', termynHari: 30, updatedAt: 't', updatedByEventId: 'e' })
    const user = userEvent.setup()
    render(<PelangganPicker id="p" value={null} onChange={vi.fn()} />)

    await user.click(await screen.findByRole('combobox', { name: 'Pelanggan' }))

    expect(screen.getByRole('option', { name: 'Budi' })).toHaveAccessibleDescription('0812-555')
  })

  it('quick-adds a typed name as a customer and selects it', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PelangganPicker id="p" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('combobox', { name: 'Pelanggan' }))
    await user.type(screen.getByRole('combobox', { name: 'Pelanggan' }), 'Toko Baru')
    await user.click(screen.getByText(/tambah.*Toko Baru/i))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String)))
    expect((await db.customersProj.toArray()).map(c => c.nama)).toEqual(['Toko Baru'])
  })

  it('the + button opens the full form and saves telepon and alamat', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PelangganPicker id="p" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Tambah pelanggan baru' }))
    await user.type(screen.getByLabelText('Nama'), 'Sari')
    await user.type(screen.getByLabelText('Telepon'), '0813')
    await user.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String)))
    expect((await db.customersProj.toArray())[0]).toMatchObject({ nama: 'Sari', telepon: '0813' })
  })
})
