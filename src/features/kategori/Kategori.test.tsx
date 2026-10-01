import 'fake-indexeddb/auto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { Kategori } from './Kategori'
import { kategoriIdForName } from '../../domain/kategori'

const stamp = { updatedAt: '2026-09-30T00:00:00.000Z', updatedByEventId: 'e' }
const renderScreen = () => render(<MemoryRouter><Kategori /></MemoryRouter>)

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Kategori screen', () => {
  it('shows an empty state with no kategori', async () => {
    renderScreen()
    expect(await screen.findByText(/Belum ada kategori/)).toBeInTheDocument()
  })

  it('lists master and legacy kategori with how many barang use each', async () => {
    await db.kategoriProj.put({ id: 'kat_alat', nama: 'Alat', diarsipkan: false, ...stamp })
    await db.barangProj.put({ id: 'b1', nama: 'Palu', kategoriId: 'kat_alat', diarsipkan: false, ...stamp })
    await db.barangProj.put({ id: 'b2', nama: 'Semen A', kategori: 'Semen', diarsipkan: false, ...stamp })
    await db.barangProj.put({ id: 'b3', nama: 'Semen B', kategori: 'semen', diarsipkan: false, ...stamp })
    renderScreen()
    expect(await screen.findByRole('button', { name: /Alat/ })).toHaveTextContent('1 barang')
    expect(screen.getByRole('button', { name: /Semen/ })).toHaveTextContent('2 barang')
  })

  it('adds a kategori from + Kategori baru', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(await screen.findByRole('button', { name: '+ Kategori baru' }))
    const sheet = screen.getByRole('dialog', { name: 'Kategori baru' })
    await user.type(within(sheet).getByLabelText(/Nama kategori/), 'Cat')
    await user.click(within(sheet).getByRole('button', { name: 'Simpan' }))
    await waitFor(async () => expect(await db.kategoriProj.get(kategoriIdForName('Cat'))).toMatchObject({ nama: 'Cat' }))
    expect(await screen.findByRole('button', { name: /Cat/ })).toBeInTheDocument()
  })

  it('renames a kategori', async () => {
    await db.kategoriProj.put({ id: 'kat_alat', nama: 'Alat', diarsipkan: false, ...stamp })
    const user = userEvent.setup()
    renderScreen()
    await user.click(await screen.findByRole('button', { name: /Alat/ }))
    const sheet = screen.getByRole('dialog', { name: 'Ubah kategori' })
    const field = within(sheet).getByLabelText(/Nama kategori/)
    await user.clear(field)
    await user.type(field, 'Perkakas')
    await user.click(within(sheet).getByRole('button', { name: 'Simpan' }))
    await waitFor(async () => expect((await db.kategoriProj.get('kat_alat'))!.nama).toBe('Perkakas'))
  })

  it('renaming a legacy-only kategori materializes it under its derived id', async () => {
    await db.barangProj.put({ id: 'b1', nama: 'Cat A', kategori: 'Cat', diarsipkan: false, ...stamp })
    const user = userEvent.setup()
    renderScreen()
    await user.click(await screen.findByRole('button', { name: /Cat/ }))
    const sheet = screen.getByRole('dialog', { name: 'Ubah kategori' })
    const field = within(sheet).getByLabelText(/Nama kategori/)
    await user.clear(field)
    await user.type(field, 'Cat Tembok')
    await user.click(within(sheet).getByRole('button', { name: 'Simpan' }))
    await waitFor(async () => expect(await db.kategoriProj.get(kategoriIdForName('Cat'))).toMatchObject({ nama: 'Cat Tembok' }))
  })

  it('shows an archived kategori flagged "Diarsipkan"', async () => {
    await db.kategoriProj.put({ id: 'kat_x', nama: 'Lama', diarsipkan: true, ...stamp })
    renderScreen()
    expect(await screen.findByRole('button', { name: /Lama/ })).toHaveTextContent('Diarsipkan')
  })
})
