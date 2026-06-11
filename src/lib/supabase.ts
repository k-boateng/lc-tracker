import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings.'
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    flowType: 'implicit',
    // Auto-detection has a buggy fetch path in 2.108; we do it manually in AuthContext
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
})
