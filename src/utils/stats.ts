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

// Count of dates within the last 7 calendar days (inclusive of today)
export function countLast7Days(reviewDates: string[]): number {
  const cutoff = new Date(today() + 'T00:00:00')
  cutoff.setDate(cutoff.getDate() - 6)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return reviewDates.filter(d => d >= cutoffStr).length
}
