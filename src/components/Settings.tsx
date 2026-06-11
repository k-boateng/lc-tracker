import { useState, useRef, useEffect } from 'react'
import type { Problem } from '../types'
import { getSettings, saveSettings } from '../utils/storage'
import {
  deleteAllProblems, isUsernameTaken, claimUsername,
  getEmailDigestEnabled, setEmailDigestEnabled,
} from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  problems: Problem[]
  isDark: boolean
  onToggleDark: () => void
  onImport: (problems: Problem[]) => Promise<void>
}

const USERNAME_RE = /^[a-z0-9_-]{3,20}$/

export function Settings({ problems, isDark, onToggleDark, onImport }: Props) {
  const { session, profile, refreshProfile } = useAuth()
  const [dailyGoal, setDailyGoal] = useState(() => getSettings().dailyGoal)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Email digest opt-in
  const [digestEnabled, setDigestEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (!session) return
    getEmailDigestEnabled(session.user.id).then(setDigestEnabled)
  }, [session])
  const toggleDigest = async () => {
    if (!session || digestEnabled === null) return
    const next = !digestEnabled
    setDigestEnabled(next)
    try { await setEmailDigestEnabled(session.user.id, next) }
    catch { setDigestEnabled(!next) }
  }

  // Handle rename state
  const [handle, setHandle] = useState(profile?.username ?? '')
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unchanged'>('idle')
  const [handleSaving, setHandleSaving] = useState(false)
  const [handleSavedAt, setHandleSavedAt] = useState(0)

  useEffect(() => {
    if (profile?.username && !handle) setHandle(profile.username)
  }, [profile?.username, handle])

  useEffect(() => {
    if (!session || !profile) return
    const v = handle.trim()
    if (v === profile.username) {
      setHandleStatus('unchanged')
      return
    }
    if (v.length === 0) { setHandleStatus('idle'); return }
    if (!USERNAME_RE.test(v)) { setHandleStatus('invalid'); return }
    setHandleStatus('checking')
    const t = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(v, session.user.id)
        setHandleStatus(taken ? 'taken' : 'available')
      } catch {
        setHandleStatus('idle')
      }
    }, 350)
    return () => clearTimeout(t)
  }, [handle, session, profile])

  const saveHandle = async () => {
    if (!session || handleStatus !== 'available' || handleSaving) return
    setHandleSaving(true)
    try {
      await claimUsername(session.user.id, handle.trim())
      await refreshProfile()
      setHandleSavedAt(Date.now())
      setTimeout(() => setHandleSavedAt(0), 2500)
    } catch (err: any) {
      setImportError(err.message ?? 'Failed to update handle')
    } finally {
      setHandleSaving(false)
    }
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(problems, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lc-tracker-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setImportSuccess(false)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(data)) throw new Error('Expected an array of problems')
        await onImport(data as Problem[])
        setImportSuccess(true)
        setTimeout(() => setImportSuccess(false), 3000)
      } catch (err: any) {
        setImportError(err.message ?? 'Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleReset = async () => {
    if (confirmReset) {
      if (!session) return
      try {
        await deleteAllProblems(session.user.id)
        window.location.reload()
      } catch (err: any) {
        setImportError(err.message ?? 'Reset failed')
        setConfirmReset(false)
      }
    } else {
      setConfirmReset(true)
    }
  }

  const handleGoalChange = (v: number) => {
    setDailyGoal(v)
    const settings = getSettings()
    saveSettings({ ...settings, dailyGoal: v })
  }

  const handleStatusLine = () => {
    switch (handleStatus) {
      case 'invalid':
        return <span className="text-warning">3–20 chars: lowercase letters, digits, - or _</span>
      case 'checking':
        return <span className="text-secondary">checking availability…</span>
      case 'available':
        return <span className="text-success">✓ available — click rename to save</span>
      case 'taken':
        return <span className="text-danger">✗ taken</span>
      case 'unchanged':
        return handleSavedAt ? <span className="text-success">✓ renamed</span> : <span className="text-secondary">your leaderboard handle</span>
      default:
        return <span className="text-secondary">your leaderboard handle</span>
    }
  }

  return (
    <div className="p-6 max-w-xl space-y-8">
      <h2 className="text-base font-medium text-primary">Settings</h2>

      {/* Account */}
      <section className="bg-surface border border-border p-5 space-y-4">
        <div className="text-xs text-secondary uppercase tracking-wider">Account</div>
        <div>
          <div className="text-sm text-primary mb-1">Handle</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg border border-border px-3 py-2 focus-within:border-accent transition-colors">
              <span className="text-accent text-sm">❯</span>
              <span className="text-secondary text-sm">whoami =</span>
              <input
                value={handle}
                onChange={e => setHandle(e.target.value.toLowerCase())}
                maxLength={20}
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent text-sm text-primary focus:outline-none"
              />
            </div>
            <button
              onClick={saveHandle}
              disabled={handleStatus !== 'available' || handleSaving}
              className="px-4 py-2 border border-accent/40 bg-accent/5 text-sm text-accent hover:bg-accent/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {handleSaving ? 'saving…' : 'rename'}
            </button>
          </div>
          <div className="text-xs mt-2 h-4">{handleStatusLine()}</div>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-surface border border-border p-5 space-y-4">
        <div className="text-xs text-secondary uppercase tracking-wider">Appearance</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-primary">Dark mode</div>
            <div className="text-xs text-secondary mt-0.5">Currently {isDark ? 'dark' : 'light'}</div>
          </div>
          <button
            onClick={onToggleDark}
            className={`w-11 h-6 rounded-full transition-colors relative ${isDark ? 'bg-accent' : 'bg-border'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-surface border border-border p-5 space-y-4">
        <div className="text-xs text-secondary uppercase tracking-wider">Notifications</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-primary">Daily nudge email</div>
            <div className="text-xs text-secondary mt-0.5">One email a day, max — streak at risk, rank changes, invite updates.</div>
          </div>
          <button
            onClick={toggleDigest}
            disabled={digestEnabled === null}
            className={`w-11 h-6 rounded-full transition-colors relative ${digestEnabled ? 'bg-accent' : 'bg-border'} ${digestEnabled === null ? 'opacity-40' : ''}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${digestEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </section>

      {/* Review goal */}
      <section className="bg-surface border border-border p-5 space-y-4">
        <div className="text-xs text-secondary uppercase tracking-wider">Review Goal</div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm text-primary">Daily review goal</div>
            <div className="text-xs text-secondary mt-0.5">Problems to review per day</div>
          </div>
          <input
            type="number"
            min={1}
            max={50}
            value={dailyGoal}
            onChange={e => handleGoalChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 bg-bg border border-border px-2 py-1.5 text-sm text-primary font-mono text-center focus:outline-none focus:border-accent"
          />
        </div>
      </section>

      {/* Data management */}
      <section className="bg-surface border border-border p-5 space-y-4">
        <div className="text-xs text-secondary uppercase tracking-wider">Data</div>
        <div className="text-xs text-secondary bg-warning/10 border border-warning/30 px-3 py-2">
          Your data syncs to the cloud and is available on any device you sign in to. Export occasionally as an extra backup.
        </div>

        <div className="flex flex-col gap-3">
          {/* Export */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-primary">Export backup</div>
              <div className="text-xs text-secondary">{problems.length} problems → JSON file</div>
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-border text-sm text-secondary hover:text-primary hover:border-secondary transition-colors"
            >
              Export
            </button>
          </div>

          {/* Import */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-primary">Import backup</div>
              <div className="text-xs text-secondary">Replaces all current data</div>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 border border-border text-sm text-secondary hover:text-primary hover:border-secondary transition-colors"
            >
              Import
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
          {importError && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/30 px-3 py-2">{importError}</div>
          )}
          {importSuccess && (
            <div className="text-xs text-success bg-success/10 border border-success/30 px-3 py-2">Import successful!</div>
          )}

          {/* Reset */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <div className="text-sm text-danger">Reset all data</div>
              <div className="text-xs text-secondary">Permanently deletes everything</div>
            </div>
            <button
              onClick={handleReset}
              onBlur={() => setConfirmReset(false)}
              className={`px-4 py-2 border text-sm transition-colors ${
                confirmReset
                  ? 'border-danger bg-danger text-white'
                  : 'border-danger/40 text-danger hover:bg-danger/10'
              }`}
            >
              {confirmReset ? 'Confirm Reset' : 'Reset'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
