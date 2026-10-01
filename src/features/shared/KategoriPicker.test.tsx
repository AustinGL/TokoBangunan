import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '../../data/db'
import { KategoriPicker } from './KategoriPicker'
import { kategoriIdForName } from '../../domain/kategori'

const stamp = { updatedAt: '2026-09-30T00:00:00.000Z', updatedByEventId: 'e' }

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('KategoriPicker', () => {
  it('lists master and legacy kategori, but not archived ones', async () => {
    await db.kategoriProj.put({ id: 'kat_a', nama: 'Alat', diarsipkan: false, ...stamp })
    await db.kategoriProj.put({ id: 'kat_x', nama: 'Lama', diarsipkan: true, ...stamp })
    await db.barangProj.put({ id: 'b1', nama: 'x', kategori: 'Semen', diarsipkan: false, ...stamp })
    const user = userEvent.setup()
    render(<KategoriPicker value={null} onChange={vi.fn()} />)
    await user.click(await screen.findByRole('combobox', { name: 'Kategori' }))
    expect(screen.getByRole('option', { name: 'Alat' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Semen' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Lama' })).not.toBeInTheDocument()
  })

  it('still shows the currently selected kategori when it is archived', async () => {
    await db.kategoriProj.put({ id: 'kat_x', nama: 'Lama', diarsipkan: true, ...stamp })
    render(<KategoriPicker value="kat_x" onChange={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Kategori' })).toHaveValue('Lama'))
  })

  it('offers "Tanpa kategori", which selects null', async () => {
    await db.kategoriProj.put({ id: 'kat_a', nama: 'Alat', diarsipkan: false, ...stamp })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<KategoriPicker value="kat_a" onChange={onChange} />)
    await user.click(await screen.findByRole('combobox', { name: 'Kategori' }))
    await user.click(screen.getByRole('option', { name: 'Tanpa kategori' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('selecting an existing kategori reports its id', async () => {
    await db.kategoriProj.put({ id: 'kat_a', nama: 'Alat', diarsipkan: false, ...stamp })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<KategoriPicker value={null} onChange={onChange} />)
    await user.click(await screen.findByRole('combobox', { name: 'Kategori' }))
    await user.click(screen.getByRole('option', { name: 'Alat' }))
    expect(onChange).toHaveBeenCalledWith('kat_a')
  })

  it('selecting a legacy-only kategori reports its derived id', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'x', kategori: 'Semen', diarsipkan: false, ...stamp })
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<KategoriPicker value={null} onChange={onChange} />)
    await user.click(await screen.findByRole('combobox', { name: 'Kategori' }))
    await user.click(screen.getByRole('option', { name: 'Semen' }))
    expect(onChange).toHaveBeenCalledWith(kategoriIdForName('Semen'))
  })

  it('creates a kategori by typing a new name, and selects it', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<KategoriPicker value={null} onChange={onChange} />)
    const box = await screen.findByRole('combobox', { name: 'Kategori' })
    await user.click(box)
    await user.type(box, 'Cat Baru')
    await user.click(screen.getByText(/tambah.*Cat Baru/i))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(kategoriIdForName('Cat Baru')))
    expect((await db.kategoriProj.get(kategoriIdForName('Cat Baru')))!.nama).toBe('Cat Baru')
  })

  it('the "+" opens the kategori form and selects what it saves', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<KategoriPicker value={null} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Tambah kategori baru' }))
    const sheet = await screen.findByRole('dialog', { name: 'Kategori baru' })
    await user.type(within(sheet).getByLabelText(/Nama kategori/), 'Besi')
    await user.click(within(sheet).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(kategoriIdForName('Besi')))
  })

  it('the "+" matches the field height and shape', () => {
    render(<KategoriPicker value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Tambah kategori baru' })).toHaveClass('h-control', 'w-control', 'rounded-field')
  })
})
