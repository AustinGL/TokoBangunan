import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './supabaseConfig'

/**
 * Cloud config must never be a boot dependency.
 *
 * createClient throws "supabaseUrl is required" when the env var is missing,
 * and a missing .env used to take the entire app (and the whole test suite,
 * before a single test ran) down at import time. That inverts the local-first
 * premise: the log, the projections and every screen work with no server at
 * all, and sync is the one thing that does not.
 *
 * Falling back to a syntactically valid placeholder keeps the module's shape
 * identical for every caller. Nothing is dialled at construction time, so an
 * unconfigured client costs nothing until a sync is attempted, at which point
 * it fails the same way being offline does and the UI already reports that
 * honestly as "Belum tersinkron".
 *
 * Only ever imported lazily from the shell (App.tsx imports sync.ts with a
 * dynamic import): see supabaseConfig.ts for why.
 */
const PLACEHOLDER_URL = 'http://localhost:54321'
const PLACEHOLDER_ANON_KEY = 'anon-key-not-configured'

if (!isSupabaseConfigured) {
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Running with a ' +
    'placeholder Supabase client: the app works offline, but sync will fail. ' +
    'Copy .env.example to .env to configure it.',
  )
}

export { isSupabaseConfigured }

export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || PLACEHOLDER_ANON_KEY,
  // detectSessionInUrl off: the app has no magic-link or OAuth flow, so there is
  // no legitimate way for a session to arrive in the URL, and a sign-in path
  // that accepts tokens from the address bar is one we do not want open.
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
)
