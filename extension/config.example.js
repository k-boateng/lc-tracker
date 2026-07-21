// Copy this file to config.local.js and fill in your Supabase project's
// URL + anon key (Supabase dashboard -> Project Settings -> API).
// Same values as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in the main
// app's .env.local — this is the same project, so RLS treats a session
// from here identically to a session from the web app.
globalThis.LC_NOTES_CONFIG = {
  SUPABASE_URL: 'https://your-project-ref.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',
}
