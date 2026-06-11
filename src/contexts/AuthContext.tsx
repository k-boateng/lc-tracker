import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string

export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  onboarded: boolean
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // OAuth redirect lands here with #access_token=...&refresh_token=...
    // Supabase JS 2.108 has a bug where setSession() / detectSessionInUrl
    // call _getUser internally and fetch fails with "non ISO-8859-1 code
    // point" in the headers. We bypass that entirely: decode the JWT, write
    // the session straight to localStorage, then reload so the client picks
    // it up as a stored session (no network validation needed on load).
    const consumeHashSession = (): boolean => {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : ''
      if (!hash.includes('access_token')) return false
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      const expires_in = parseInt(params.get('expires_in') ?? '3600', 10)
      const token_type = params.get('token_type') ?? 'bearer'
      if (!access_token || !refresh_token) return false

      let payload: any = {}
      try {
        const b64 = access_token.split('.')[1]
          .replace(/-/g, '+').replace(/_/g, '/')
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
        payload = JSON.parse(decodeURIComponent(escape(atob(padded))))
      } catch {
        return false
      }

      const expires_at = Math.floor(Date.now() / 1000) + expires_in
      const supaSession = {
        access_token,
        refresh_token,
        expires_in,
        expires_at,
        token_type,
        user: {
          id: payload.sub,
          aud: payload.aud ?? 'authenticated',
          role: payload.role ?? 'authenticated',
          email: payload.email,
          email_confirmed_at: payload.email_verified ? new Date().toISOString() : null,
          phone: payload.phone ?? '',
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          app_metadata: payload.app_metadata ?? { provider: 'google', providers: ['google'] },
          user_metadata: payload.user_metadata ?? {},
          identities: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_anonymous: false,
        },
      }

      const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
      if (!ref) return false
      const storageKey = `sb-${ref}-auth-token`
      localStorage.setItem(storageKey, JSON.stringify(supaSession))

      // Strip the hash and reload — initializer will read from storage.
      window.location.replace(window.location.pathname + window.location.search)
      return true
    }

    const init = async () => {
      if (consumeHashSession()) return // reload in progress
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, onboarded')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    fetchProfile(session.user.id)
  }, [session])

  const refreshProfile = async () => {
    if (session) await fetchProfile(session.user.id)
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
