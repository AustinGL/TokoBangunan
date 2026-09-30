import { supabase } from './supabase'

/**
 * Owner sign-in for cloud backup. Signing in is optional: the shop works fully
 * without it (local-first), and sync simply says "Belum masuk" until it
 * happens (sync.ts, BelumMasukError). Nothing here ever logs, stores or echoes
 * the password.
 */
export type AuthResult = { ok: true } | { ok: false; message: string }

const GENERIC = 'Gagal masuk. Coba lagi.'

type AuthLikeError = { message?: unknown; code?: unknown; status?: unknown; name?: unknown }

/**
 * A Supabase auth failure as one sentence the owner can act on. The raw server
 * text is never shown: it is English, technical, and can name internals.
 */
export function authErrorMessage(error: unknown): string {
  const e = (typeof error === 'object' && error !== null ? error : {}) as AuthLikeError
  const code = typeof e.code === 'string' ? e.code : ''
  const message = typeof e.message === 'string' ? e.message : ''
  const status = typeof e.status === 'number' ? e.status : undefined

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return 'Email atau password salah.'
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) return 'Email belum dikonfirmasi.'
  if (status === 429 || code === 'over_request_rate_limit' || /rate limit/i.test(message)) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
  }
  if (e.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return 'Tidak bisa terhubung. Periksa koneksi internet.'
  }
  return GENERIC
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    // The password goes through exactly as typed (a trailing space is part of it); only the email is trimmed.
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return error ? { ok: false, message: authErrorMessage(error) } : { ok: true }
  } catch (error) {
    return { ok: false, message: authErrorMessage(error) }
  }
}

/**
 * 'local' scope: ends this device's session only. The default ('global')
 * would sign the owner out of every other device too (the phone at the
 * counter, the laptop in the back).
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    return error ? { ok: false, message: authErrorMessage(error) } : { ok: true }
  } catch (error) {
    return { ok: false, message: authErrorMessage(error) }
  }
}
