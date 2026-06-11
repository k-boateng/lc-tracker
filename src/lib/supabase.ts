import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings.'
  )
}

// Supabase JS 2.108 occasionally puts non-ISO-8859-1 chars in headers
// (X-Client-Info or a token field), which makes the browser throw
// "Failed to execute 'set' on 'Headers'". We sanitize header values
// before fetch sees them — anything > 0xFF is dropped.
function sanitizeValue(v: unknown): string {
  return String(v).replace(/[^\x00-\xFF]/g, '')
}

function safeHeaders(input: HeadersInit | undefined): HeadersInit | undefined {
  if (!input) return input
  if (input instanceof Headers) {
    const out: Record<string, string> = {}
    input.forEach((v, k) => { out[k] = sanitizeValue(v) })
    return out
  }
  if (Array.isArray(input)) {
    return input.map(([k, v]) => [k, sanitizeValue(v)]) as [string, string][]
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input)) out[k] = sanitizeValue(v)
  return out
}

const safeFetch: typeof fetch = (input, init) => {
  if (init?.headers) init = { ...init, headers: safeHeaders(init.headers) }
  return fetch(input, init)
}

export const supabase = createClient(url, anonKey, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: safeFetch,
    headers: { 'X-Client-Info': 'supabase-js-web/2.108.1' },
  },
})
