import { describe, it, expect } from 'vitest'
import { supabase } from './supabase'

describe('supabase client', () => {
  it('does not sign in from tokens in the URL: the app has no magic-link or OAuth flow, so that path stays closed', () => {
    expect(Reflect.get(supabase.auth, 'detectSessionInUrl')).toBe(false)
  })
})
