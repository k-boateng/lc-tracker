import { today } from './dates'

// Consecutive calendar days ending today with >=1 review.
// Shared by the dashboard stats bar and the group leaderboard.
export function computeStreak(reviewDates: Iterable<string>): number {
  const dates = reviewDates instanceof Set ? reviewDates : new Set(reviewDates)
  const t = today()
  if (!dates.has(t)) return 0

  let streak = 1
  let check = t
  while (true) {
    const prev = new Date(check + 'T00:00:00')
    prev.setDate(prev.getDate() - 1)
    const prevStr = prev.toISOString().split('T')[0]
    if (dates.has(prevStr)) {
      streak++
      check = prevStr
    } else {
      break
    }
  }
  return streak
}

// If nothing is reviewed today, how long is the streak that dies at midnight?
// Returns 0 when there's no streak to lose (or today is already covered).
export function streakAtRisk(reviewDates: Iterable<string>): number {
  const dates = reviewDates instanceof Set ? new Set(reviewDates) : new Set(reviewDates)
  const t = today()
  if (dates.has(t)) return 0
  dates.add(t)
  return computeStreak(dates) - 1
}

// Monday 00:00 UTC of the current week, as an ISO date string.
// Matches Postgres date_trunc('week', now() at time zone 'utc').
export function weekStartUTC(): string {
  const now = new Date()
  const dow = now.getUTCDay() // 0 Sun .. 6 Sat
  const sinceMonday = (dow + 6) % 7
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday))
  return monday.toISOString().split('T')[0]
}

// Next Monday 00:00 UTC — when the weekly round resets.
export function nextResetUTC(): Date {
  const now = new Date()
  const dow = now.getUTCDay()
  const daysUntilMonday = ((8 - dow) % 7) || 7
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday))
}

// Count of review dates inside the current weekly round
export function countThisWeek(reviewDates: string[]): number {
  const start = weekStartUTC()
  return reviewDates.filter(d => d >= start).length
}
