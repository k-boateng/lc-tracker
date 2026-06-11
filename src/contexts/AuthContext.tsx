import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

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
    // We parse it manually (Supabase JS 2.108's detectSessionInUrl path
    // throws "non ISO-8859-1 code point" in its internal user-fetch).
    const consumeHashSession = async () => {
      const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : ''
      if (!hash.includes('access_token')) return false
      const params = new URLSearchParams(hash)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) return false
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
      if (error || !data.session) return false
      // Clear the tokens from the URL bar
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setSession(data.session)
      return true
    }

    const init = async () => {
      const consumed = await consumeHashSession()
      if (!consumed) {
        const { data } = await supabase.auth.getSession()
        setSession(data.session)
      }
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
