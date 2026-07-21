// Mirrors src/lib/supabase.ts's client config: implicit flow, no built-in
// URL session detection (auth is handled manually in popup.js/content.js
// instead), and the same header-sanitizing fetch wrapper for the known
// supabase-js 2.108 bug where a non-ISO-8859-1 header value makes the
// browser throw "Failed to execute 'set' on 'Headers'".
//
// persistSession/autoRefreshToken are off: the client's own storage
// adapter defaults to localStorage, which is the wrong store in every
// extension context (see session.js) — session persistence is handled
// explicitly via chrome.storage.local instead.

function sanitizeHeaderValue(v) {
  return String(v).replace(/[^\x00-\xFF]/g, '')
}

function safeHeaders(input) {
  if (!input) return input
  if (input instanceof Headers) {
    const out = {}
    input.forEach((v, k) => { out[k] = sanitizeHeaderValue(v) })
    return out
  }
  if (Array.isArray(input)) {
    return input.map(([k, v]) => [k, sanitizeHeaderValue(v)])
  }
  const out = {}
  for (const [k, v] of Object.entries(input)) out[k] = sanitizeHeaderValue(v)
  return out
}

function safeFetch(input, init) {
  if (init && init.headers) init = { ...init, headers: safeHeaders(init.headers) }
  return fetch(input, init)
}

function createLcNotesClient() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = globalThis.LC_NOTES_CONFIG
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: false,
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: safeFetch,
      headers: { 'X-Client-Info': 'lc-notes-extension/0.1.0' },
    },
  })
}
