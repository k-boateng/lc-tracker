// All day/streak/round logic runs in ONE app timezone so a user's personal
// streak always matches their shared leaderboard points. Change this single
// constant (and the matching `at time zone` literal in the SQL functions) to
// move the whole app to a different zone.
export const APP_TZ = 'America/New_York'

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ })

// Calendar date (YYYY-MM-DD) of an instant, in the app timezone
export function toISO(date: Date): string {
  return ymd.format(date)
}

// Today's calendar date in the app timezone
export function today(): string {
  return ymd.format(new Date())
}

// Pure date-string arithmetic — anchored at UTC noon so it's independent of
// the device timezone and immune to DST edges.
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T12:00:00Z')
  const db = new Date(b + 'T12:00:00Z')
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

export function daysSince(isoDate: string): number {
  return daysBetween(isoDate, today())
}

export function isOverdue(nextReview: string): boolean {
  return nextReview < today()
}

export function isDueToday(nextReview: string): boolean {
  return nextReview <= today()
}

export function formatRelative(isoDate: string): string {
  const diff = daysBetween(today(), isoDate)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 0) return `in ${diff} days`
  return `${Math.abs(diff)} days ago`
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// How many ms the app timezone is offset from UTC at a given instant
// (positive = ahead of UTC). DST-correct via Intl.
function tzOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value
  const asUTC = Date.UTC(
    +map.year, +map.month - 1, +map.day,
    +map.hour === 24 ? 0 : +map.hour, +map.minute, +map.second,
  )
  return asUTC - date.getTime()
}

// The UTC instant of local midnight on a given app-timezone calendar date
export function zonedMidnight(isoDate: string): Date {
  const guess = new Date(isoDate + 'T00:00:00Z')
  return new Date(guess.getTime() - tzOffsetMs(guess))
}
