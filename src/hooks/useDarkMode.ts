import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '../utils/storage'

// One-time migration marker: older builds had a broken toggle that could
// persist darkMode:false unintentionally. Reset everyone to dark once;
// any toggle after that is respected.
const THEME_MIGRATION_KEY = 'lc_tracker_theme_v2'

function initialDark(): boolean {
  const settings = getSettings()
  if (!localStorage.getItem(THEME_MIGRATION_KEY)) {
    localStorage.setItem(THEME_MIGRATION_KEY, '1')
    if (!settings.darkMode) {
      saveSettings({ ...settings, darkMode: true })
    }
    return true
  }
  return settings.darkMode
}

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(initialDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  const toggle = () => {
    setIsDark(prev => {
      const next = !prev
      const settings = getSettings()
      saveSettings({ ...settings, darkMode: next })
      return next
    })
  }

  return [isDark, toggle]
}
