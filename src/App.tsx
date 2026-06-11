import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { ProblemLibrary } from './components/ProblemLibrary'
import { Analytics } from './components/Analytics'
import { Settings } from './components/Settings'
import { Groups } from './components/Groups'
import { Login } from './components/Login'
import { Landing } from './components/Landing'
import { Onboarding } from './components/Onboarding'
import { useProblems } from './hooks/useProblems'
import { useDarkMode } from './hooks/useDarkMode'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { getLegacyProblems, clearLegacyProblems } from './utils/storage'
import { joinGroup } from './utils/api'
import type { Problem } from './types'

const PENDING_INVITE_KEY = 'lc_tracker_pending_invite'

// Capture /join/<code> from an invite link before anything renders, so the
// code survives the OAuth redirect round-trip.
const joinMatch = window.location.pathname.match(/^\/join\/([a-zA-Z0-9]{4,12})$/)
if (joinMatch) {
  localStorage.setItem(PENDING_INVITE_KEY, joinMatch[1].toUpperCase())
  window.history.replaceState(null, '', '/')
}

export function getPendingInvite(): string | null {
  return localStorage.getItem(PENDING_INVITE_KEY)
}

function AppContent() {
  const { session, profile, loading: authLoading } = useAuth()
  const {
    problems, loading: dataLoading, error,
    addProblem, updateProblem, deleteProblem, logReview, importProblems,
  } = useProblems()
  const [isDark, toggleDark] = useDarkMode()
  const [openQuickLog, setOpenQuickLog] = useState(false)
  const [importBanner, setImportBanner] = useState<'hidden' | 'offer' | 'importing'>('hidden')

  // N key → open quick log on dashboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (e.key === 'n' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        setOpenQuickLog(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Offer one-time import of pre-migration localStorage data
  useEffect(() => {
    if (session && !dataLoading && problems.length === 0 && getLegacyProblems().length > 0) {
      setImportBanner('offer')
    }
  }, [session, dataLoading, problems.length])

  // Invite link auto-join: once signed in (profile exists), consume the
  // pending invite code. Redirect to the leaderboard only after onboarding
  // so we don't interrupt the handle-claim screen.
  useEffect(() => {
    const code = getPendingInvite()
    if (!session || !profile || !code) return
    localStorage.removeItem(PENDING_INVITE_KEY)
    joinGroup(code)
      .then(() => {
        if (profile.onboarded) window.location.replace('/groups')
      })
      .catch(() => {
        // bad/expired code — nothing to do, let them in normally
      })
  }, [session, profile])

  const handleLegacyImport = async () => {
    setImportBanner('importing')
    try {
      await importProblems(getLegacyProblems())
      clearLegacyProblems()
    } finally {
      setImportBanner('hidden')
    }
  }

  const handleImport = async (imported: Problem[]) => {
    await importProblems(imported)
  }

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg text-secondary text-sm">
        Loading…
      </div>
    )
  }

  if (!session) {
    // Invited users skip the marketing page — straight to login with the
    // "you've been invited" banner. Everyone else gets the landing page.
    return getPendingInvite() ? <Login /> : <Landing />
  }

  // First login: claim a handle before entering the app
  if (profile && !profile.onboarded) {
    return <Onboarding />
  }

  const legacyCount = getLegacyProblems().length

  return (
    <BrowserRouter>
      {importBanner !== 'hidden' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-accent text-white text-sm px-4 py-2.5 flex items-center justify-center gap-4">
          {importBanner === 'importing' ? (
            <span>Importing {legacyCount} problems…</span>
          ) : (
            <>
              <span>Found {legacyCount} problem{legacyCount !== 1 ? 's' : ''} on this device from before cloud sync.</span>
              <button onClick={handleLegacyImport} className="underline font-medium">Import to my account</button>
              <button
                onClick={() => { clearLegacyProblems(); setImportBanner('hidden') }}
                className="text-white/70 hover:text-white"
              >
                Discard
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 z-50 bg-danger/90 text-white text-xs px-3 py-2 rounded shadow-lg">
          {error}
        </div>
      )}

      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              dataLoading ? (
                <div className="p-6 text-sm text-secondary">Loading your problems…</div>
              ) : (
                <Dashboard
                  problems={problems}
                  onAddProblem={addProblem}
                  onLogReview={logReview}
                  openQuickLog={openQuickLog}
                  onQuickLogOpened={() => setOpenQuickLog(false)}
                />
              )
            }
          />
          <Route
            path="/library"
            element={
              <ProblemLibrary
                problems={problems}
                onUpdate={updateProblem}
                onDelete={deleteProblem}
                onReview={logReview}
              />
            }
          />
          <Route path="/analytics" element={<Analytics problems={problems} />} />
          <Route path="/groups" element={<Groups />} />
          <Route
            path="/settings"
            element={
              <Settings
                problems={problems}
                isDark={isDark}
                onToggleDark={toggleDark}
                onImport={handleImport}
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
