import { today, addDays, zonedMidnight } from './dates'

// Consecutive calendar days (app timezone) ending today with >=1 review.
// Shared by the dashboard stats bar and the group leaderboard.
export function computeStreak(reviewDates: Iterable<string>): number {
  const dates = reviewDates instanceof Set ? reviewDates : new Set(reviewDates)
  const t = today()
  if (!dates.has(t)) return 0

  let streak = 1
  let check = t
  while (true) {
    const prevStr = addDays(check, -1)
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

// Monday of the current week (app timezone), as a YYYY-MM-DD string.
// Matches Postgres date_trunc('week', now() at time zone APP_TZ).
export function weekStart(): string {
  const t = today()
  const dow = new Date(t + 'T12:00:00Z').getUTCDay() // 0 Sun .. 6 Sat
  const sinceMonday = (dow + 6) % 7
  return addDays(t, -sinceMonday)
}

// The instant the current weekly round resets: next Monday 00:00 app-local.
export function nextReset(): Date {
  const nextMonday = addDays(weekStart(), 7)
  return zonedMidnight(nextMonday)
}

// Count of review dates inside the current weekly round
export function countThisWeek(reviewDates: string[]): number {
  const start = weekStart()
  return reviewDates.filter(d => d >= start).length
}
