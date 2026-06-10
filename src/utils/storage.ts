import type { Problem, AppSettings } from '../types'

const PROBLEMS_KEY = 'lc_tracker_problems'
const SETTINGS_KEY = 'lc_tracker_settings'
const VERSION_KEY = 'lc_tracker_version'
// Bump this to wipe stale data across deploys
const CURRENT_VERSION = '2'

function ensureVersion() {
  if (localStorage.getItem(VERSION_KEY) !== CURRENT_VERSION) {
    localStorage.removeItem(PROBLEMS_KEY)
    localStorage.removeItem(SETTINGS_KEY)
    localStorage.setItem(VERSION_KEY, CURRENT_VERSION)
  }
}

export function getProblems(): Problem[] {
  ensureVersion()
  try {
    const raw = localStorage.getItem(PROBLEMS_KEY)
    if (raw) return JSON.parse(raw) as Problem[]
  } catch {
    // ignore parse error
  }
  return []
}

export function saveProblems(problems: Problem[]): void {
  localStorage.setItem(PROBLEMS_KEY, JSON.stringify(problems))
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  dailyGoal: 5,
}

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function clearAllData(): void {
  localStorage.removeItem(PROBLEMS_KEY)
  localStorage.removeItem(SETTINGS_KEY)
  localStorage.removeItem(VERSION_KEY)
}
