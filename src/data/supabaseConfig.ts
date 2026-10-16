/**
 * Whether a cloud project is configured, without loading the Supabase client.
 *
 * The client library is about a third of the app's JavaScript, and nothing
 * needs it for the first screen: sync starts after mount, and a shop with no
 * .env never talks to a server at all. Keeping the flag here lets the shell
 * decide what to show at start-up while supabase.ts (and with it the library)
 * is only fetched once a sync or the sign-in screen actually needs it.
 */
export const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * False when no cloud project is configured (no .env). The app is then
 * deliberately local-only, which is a normal state, not a sync failure:
 * App.tsx skips the network attempt and the sync indicator says so.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
