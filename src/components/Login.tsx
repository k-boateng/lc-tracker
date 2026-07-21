import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { peekGroup } from '../utils/api'
import { getPendingInvite } from '../App'

export function Login() {
  const { signInWithGoogle } = useAuth()
  const [invitedTo, setInvitedTo] = useState<string | null>(null)

  useEffect(() => {
    const code = getPendingInvite()
    if (code) peekGroup(code).then(setInvitedTo)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-primary font-mono p-4">
      <div className="bg-surface border border-border w-full max-w-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
          <span className="text-xs text-secondary ml-2">~/lc-tracker — login</span>
        </div>
        <div className="p-8 space-y-6">
          <div>
            <div className="font-display text-lg text-accent font-bold tracking-tight">~/lc-tracker</div>
            <div className="text-xs text-secondary mt-1.5">
              <span className="text-accent">❯</span> spaced repetition for problem grinding
            </div>
          </div>

          {invitedTo && (
            <div className="text-xs text-warning border border-warning/40 bg-warning/10 px-3 py-2.5 leading-relaxed">
              ❯ you've been invited to join <span className="font-medium">{invitedTo}</span> — sign in and you're on the leaderboard
            </div>
          )}

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-accent/40 bg-accent/5 text-sm text-accent hover:bg-accent/15 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23zM5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            auth --google ↵
          </button>

          <div className="text-xs text-secondary/70 leading-relaxed">
            cloud sync · grind with friends · leaderboard accountability
          </div>
        </div>
      </div>
    </div>
  )
}
