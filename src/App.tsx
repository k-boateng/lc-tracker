import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { ProblemLibrary } from './components/ProblemLibrary'
import { Analytics } from './components/Analytics'
import { Settings } from './components/Settings'
import { Groups } from './components/Groups'
import { Login } from './components/Login'
import { useProblems } from './hooks/useProblems'
import { useDarkMode } from './hooks/useDarkMode'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { getLegacyProblems, clearLegacyProblems } from './utils/storage'
import type { Problem } from './types'

function AppContent() {
  const { session, loading: authLoading } = useAuth()
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
    return <Login />
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
