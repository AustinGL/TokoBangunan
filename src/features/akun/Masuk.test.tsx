import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../../data/db'
import { ToastProvider } from '../../ui/Toast'
import type { SessionState } from './useSession'

const session = vi.hoisted(() => ({ value: { status: 'keluar' } as SessionState }))
const auth = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn() }))
const cfg = vi.hoisted(() => ({ configured: true }))

vi.mock('./useSession', () => ({ useSession: () => session.value }))
vi.mock('../../data/auth', () => auth)
const persist = vi.hoisted(() => ({ requestPersistentStorage: vi.fn() }))
vi.mock('../../data/persistentStorage', () => persist)
vi.mock('../../data/supabase', () => ({ get isSupabaseConfigured() { return cfg.configured } }))

import { Masuk } from './Masuk'

const renderMasuk = () =>
  render(
    <MemoryRouter initialEntries={['/masuk']}>
      <ToastProvider>
        <Routes>
          <Route path="/masuk" element={<Masuk />} />
          <Route path="/" element={<p>Halaman beranda</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

beforeEach(async () => {
  await db.delete()
  await db.open()
  session.value = { status: 'keluar' }
  cfg.configured = true
  auth.signIn.mockReset()
  auth.signOut.mockReset()
  persist.requestPersistentStorage.mockReset()
})

describe('Masuk: signed out', () => {
  it('offers an email and a password field (the password hidden) and says the shop works without signing in', () => {
    renderMasuk()

    expect(screen.getByRole('heading', { level: 1, name: 'Masuk' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument()
    expect(screen.getByText(/kasir tetap bisa dipakai tanpa masuk/i)).toBeInTheDocument()
  })

  it('can reveal and hide the password without clearing it', async () => {
    const user = userEvent.setup()
    renderMasuk()
    const password = screen.getByLabelText('Password')

    await user.type(password, 'rahasia')
    await user.click(screen.getByRole('button', { name: 'Tampilkan kata sandi' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('rahasia')

    await user.click(screen.getByRole('button', { name: 'Sembunyikan kata sandi' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('asks for both fields, without calling the server, and moves focus to the first empty one', async () => {
    const user = userEvent.setup()
    renderMasuk()

    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(screen.getByText('Email wajib diisi.')).toBeInTheDocument()
    expect(screen.getByText('Password wajib diisi.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Email wajib diisi.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password wajib diisi.')
    expect(screen.getByLabelText('Email')).toHaveFocus()
    expect(auth.signIn).not.toHaveBeenCalled()
  })

  it('signs in, confirms it, and returns to the start page', async () => {
    auth.signIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderMasuk()

    await user.type(screen.getByLabelText('Email'), 'pemilik@toko.id')
    await user.type(screen.getByLabelText('Password'), 'rahasia')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(auth.signIn).toHaveBeenCalledWith('pemilik@toko.id', 'rahasia')
    expect(await screen.findByText('Halaman beranda')).toBeInTheDocument()
    expect(await screen.findByText('Berhasil masuk. Pencadangan dimulai.')).toBeInTheDocument()
  })

  it('says this device will remember the owner until they sign out', () => {
    renderMasuk()

    expect(screen.getByText(/perangkat ini akan mengingat anda sampai anda memilih keluar/i)).toBeInTheDocument()
  })

  it('asks the browser to keep this device remembered once signed in, so the session is not evicted', async () => {
    auth.signIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderMasuk()

    await user.type(screen.getByLabelText('Email'), 'pemilik@toko.id')
    await user.type(screen.getByLabelText('Password'), 'rahasia')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    await screen.findByText('Halaman beranda')
    expect(persist.requestPersistentStorage).toHaveBeenCalledTimes(1)
  })

  it('does not ask for persistent storage when the sign-in failed', async () => {
    auth.signIn.mockResolvedValue({ ok: false, message: 'Email atau password salah.' })
    const user = userEvent.setup()
    renderMasuk()

    await user.type(screen.getByLabelText('Email'), 'pemilik@toko.id')
    await user.type(screen.getByLabelText('Password'), 'salah')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    await screen.findByRole('alert')
    expect(persist.requestPersistentStorage).not.toHaveBeenCalled()
  })

  it('submits with Enter from the password field', async () => {
    auth.signIn.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderMasuk()

    await user.type(screen.getByLabelText('Email'), 'pemilik@toko.id')
    await user.type(screen.getByLabelText('Password'), 'rahasia{Enter}')

    expect(auth.signIn).toHaveBeenCalledTimes(1)
  })

  it('shows why it failed, stays on the form and keeps the email for another try', async () => {
    auth.signIn.mockResolvedValue({ ok: false, message: 'Email atau password salah.' })
    const user = userEvent.setup()
    renderMasuk()

    await user.type(screen.getByLabelText('Email'), 'pemilik@toko.id')
    await user.type(screen.getByLabelText('Password'), 'salah')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau password salah.')
    expect(screen.queryByText('Halaman beranda')).toBeNull()
    expect(screen.getByLabelText('Email')).toHaveValue('pemilik@toko.id')
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled()
  })

  it('ignores a second press while the first sign-in is still running', async () => {
    let finish: (value: { ok: true }) => void = () => {}
    auth.signIn.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup()
    renderMasuk()

    await user.type(screen.getByLabelText('Email'), 'pemilik@toko.id')
    await user.type(screen.getByLabelText('Password'), 'rahasia')
    await user.click(screen.getByRole('button', { name: 'Masuk' }))

    const busy = await screen.findByRole('button', { name: 'Memproses...' })
    expect(busy).toBeDisabled()
    await user.click(busy)
    expect(auth.signIn).toHaveBeenCalledTimes(1)

    finish({ ok: true })
    await waitFor(() => expect(screen.getByText('Halaman beranda')).toBeInTheDocument())
  })
})

describe('Masuk: signed in', () => {
  beforeEach(() => { session.value = { status: 'masuk', email: 'pemilik@toko.id' } })

  it('shows who is signed in and that everything is backed up when nothing waits', () => {
    renderMasuk()

    expect(screen.getByRole('heading', { level: 1, name: 'Akun' })).toBeInTheDocument()
    expect(screen.getByText('pemilik@toko.id')).toBeInTheDocument()
    expect(screen.getByText('Semua data sudah tercadangkan.')).toBeInTheDocument()
  })

  it('counts the changes still waiting to be backed up', async () => {
    await db.outbox.bulkPut([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }])
    renderMasuk()

    expect(await screen.findByText('3 perubahan menunggu dicadangkan.')).toBeInTheDocument()
  })

  it('says signing out deletes nothing, then signs out and confirms', async () => {
    auth.signOut.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderMasuk()

    expect(screen.getByText(/keluar tidak menghapus data/i)).toHaveTextContent(/tetap ada dan terlihat di perangkat ini/i)
    await user.click(screen.getByRole('button', { name: 'Keluar' }))

    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Anda sudah keluar.')).toBeInTheDocument()
  })

  it('shows the reason when signing out fails', async () => {
    auth.signOut.mockResolvedValue({ ok: false, message: 'Tidak bisa terhubung. Periksa koneksi internet.' })
    const user = userEvent.setup()
    renderMasuk()

    await user.click(screen.getByRole('button', { name: 'Keluar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Tidak bisa terhubung. Periksa koneksi internet.')
  })
})

describe('Masuk: other states', () => {
  it('shows a busy status while the device session is being read', () => {
    session.value = { status: 'memuat' }
    renderMasuk()

    expect(screen.getByRole('status')).toHaveTextContent('Memuat akun...')
  })

  it('explains that cloud backup is not set up, with no form, when there is no server configured', () => {
    cfg.configured = false
    renderMasuk()

    expect(screen.getByText(/cadangan cloud belum diatur/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).toBeNull()
  })

  it('says the account cannot be checked offline, and shows no sign-in form, rather than treating the owner as signed out', () => {
    session.value = { status: 'offline' }
    renderMasuk()

    expect(screen.getByText(/tidak bisa memeriksa akun karena perangkat sedang offline/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).toBeNull()
  })
})
