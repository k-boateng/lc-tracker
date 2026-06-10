import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '../utils/storage'

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(() => getSettings().darkMode)

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
