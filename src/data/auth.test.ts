import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./supabase', () => ({ supabase: { auth } }))

import { authErrorMessage, signIn, signOut } from './auth'

beforeEach(() => {
  auth.signInWithPassword.mockReset()
  auth.signOut.mockReset()
})

describe('authErrorMessage', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'Email atau password salah.'],
    [{ message: 'Invalid login credentials' }, 'Email atau password salah.'],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'Email belum dikonfirmasi.'],
    [{ status: 429, code: 'over_request_rate_limit', message: 'rate limit' }, 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'],
    [{ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }, 'Tidak bisa terhubung. Periksa koneksi internet.'],
    [new TypeError('Failed to fetch'), 'Tidak bisa terhubung. Periksa koneksi internet.'],
    [new TypeError('Load failed'), 'Tidak bisa terhubung. Periksa koneksi internet.'],
  ])('says something the owner can act on for %j', (error, expected) => {
    expect(authErrorMessage(error)).toBe(expected)
  })

  it('falls back to a generic sentence for anything else, and never leaks the raw server text', () => {
    expect(authErrorMessage({ message: 'duplicate key value violates unique constraint "users_pkey"' })).toBe('Gagal masuk. Coba lagi.')
    expect(authErrorMessage(undefined)).toBe('Gagal masuk. Coba lagi.')
    expect(authErrorMessage('boom')).toBe('Gagal masuk. Coba lagi.')
  })
})

describe('signIn', () => {
  it('signs in with the trimmed email and the password exactly as typed', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null })

    const result = await signIn('  pemilik@toko.id  ', '  rahasia dengan spasi ')

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'pemilik@toko.id', password: '  rahasia dengan spasi ' })
    expect(result).toEqual({ ok: true })
  })

  it('reports a wrong password as a sentence, not an exception', async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } })

    expect(await signIn('a@b.id', 'salah')).toEqual({ ok: false, message: 'Email atau password salah.' })
  })

  it('reports being offline when the request itself throws', async () => {
    auth.signInWithPassword.mockRejectedValue(new TypeError('Failed to fetch'))

    expect(await signIn('a@b.id', 'x')).toEqual({ ok: false, message: 'Tidak bisa terhubung. Periksa koneksi internet.' })
  })
})

describe('signOut', () => {
  it('ends only this device session, so a second device stays signed in', async () => {
    auth.signOut.mockResolvedValue({ error: null })

    expect(await signOut()).toEqual({ ok: true })
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('counts an offline sign-out as done: the revoke request fails but this device session is cleared anyway', async () => {
    auth.signOut.mockResolvedValue({ error: new AuthRetryableFetchError('Failed to fetch', 0) })

    expect(await signOut()).toEqual({ ok: true })
  })

  it('reports any other failure as a sentence instead of throwing', async () => {
    auth.signOut.mockResolvedValue({ error: { message: 'boom', name: 'AuthApiError', status: 500 } })
    expect(await signOut()).toEqual({ ok: false, message: 'Gagal keluar. Coba lagi.' })

    auth.signOut.mockRejectedValue(new Error('storage exploded'))
    expect(await signOut()).toEqual({ ok: false, message: 'Gagal keluar. Coba lagi.' })
  })
})
