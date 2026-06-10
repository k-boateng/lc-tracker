import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard'
import { ProblemLibrary } from './components/ProblemLibrary'
import { Analytics } from './components/Analytics'
import { Settings } from './components/Settings'
import { useProblems } from './hooks/useProblems'
import { useDarkMode } from './hooks/useDarkMode'
import { saveProblems } from './utils/storage'
import type { Problem } from './types'

export default function App() {
  const { problems, addProblem, updateProblem, deleteProblem, logReview } = useProblems()
  const [isDark, toggleDark] = useDarkMode()
  const [openQuickLog, setOpenQuickLog] = useState(false)

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

  const handleImport = (imported: Problem[]) => {
    saveProblems(imported)
    window.location.reload()
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              <Dashboard
                problems={problems}
                onAddProblem={addProblem}
                onLogReview={logReview}
                openQuickLog={openQuickLog}
                onQuickLogOpened={() => setOpenQuickLog(false)}
              />
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
