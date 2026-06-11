import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isUsernameTaken, claimUsername } from '../utils/api'

const USERNAME_RE = /^[a-z0-9_-]{3,20}$/

export function Onboarding() {
  const { session, profile, refreshProfile } = useAuth()
  const [value, setValue] = useState(profile?.username ?? '')
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    const v = value.trim()
    if (v.length === 0) {
      setStatus('idle')
      return
    }
    if (!USERNAME_RE.test(v)) {
      setStatus('invalid')
      return
    }
    setStatus('checking')
    const t = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(v, session.user.id)
        setStatus(taken ? 'taken' : 'available')
      } catch {
        setStatus('idle')
      }
    }, 350)
    return () => clearTimeout(t)
  }, [value, session])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session || status !== 'available' || saving) return
    setSaving(true)
    setError('')
    try {
      await claimUsername(session.user.id, value.trim())
      await refreshProfile()
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
      setSaving(false)
    }
  }

  const statusLine = () => {
    switch (status) {
      case 'invalid':
        return <span className="text-warning">3–20 chars: lowercase letters, digits, - or _</span>
      case 'checking':
        return <span className="text-secondary">checking availability…</span>
      case 'available':
        return <span className="text-success">✓ available</span>
      case 'taken':
        return <span className="text-danger">✗ taken</span>
      default:
        return <span className="text-secondary">this is your leaderboard handle</span>
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-bg text-primary font-mono">
      <div className="bg-surface border border-border w-96">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
          <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
          <span className="text-xs text-secondary ml-2">~/lc-tracker — setup</span>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <div className="font-display text-base text-accent font-bold tracking-tight">claim your handle</div>
            <div className="text-xs text-secondary mt-1.5">one-time setup · visible to your groups</div>
          </div>

          <div>
            <div className="flex items-center gap-2 bg-bg border border-border px-3 py-2.5 focus-within:border-accent transition-colors">
              <span className="text-accent text-sm">❯</span>
              <span className="text-secondary text-sm">whoami =</span>
              <input
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value.toLowerCase())}
                maxLength={20}
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-sm text-primary focus:outline-none"
              />
            </div>
            <div className="text-xs mt-2 h-4">{statusLine()}</div>
          </div>

          {error && (
            <div className="text-xs text-danger border border-danger/30 bg-danger/10 px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={status !== 'available' || saving}
            className="w-full py-2.5 border border-accent/40 bg-accent/5 text-sm text-accent hover:bg-accent/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saving ? 'saving…' : 'confirm ↵'}
          </button>
        </form>
      </div>
    </div>
  )
}
