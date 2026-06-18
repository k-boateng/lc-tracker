import { useMemo } from 'react'
import type { Problem, Pattern } from '../types'
import { today } from '../utils/dates'
import { computeStreak, weekStart } from '../utils/stats'

export function useStats(problems: Problem[]) {
  return useMemo(() => {
    const totalProblems = problems.length

    // Reviews in the current weekly round (since Monday 00:00 UTC),
    // consistent with the group leaderboard
    const wkStart = weekStart()
    const reviewsThisWeek = problems.reduce((acc, p) =>
      acc + p.reviews.filter(r => r.date >= wkStart).length, 0)

    // Streak: consecutive calendar days ending today with ≥1 review
    const allDates = new Set<string>()
    for (const p of problems) {
      for (const r of p.reviews) allDates.add(r.date)
    }
    const streak = computeStreak(allDates)

    // Weakest pattern: pattern with most problems whose last comfort rating < 3
    const patternWeakCount: Partial<Record<Pattern, number>> = {}
    for (const p of problems) {
      if (p.comfort_history.length === 0) continue
      const lastComfort = p.comfort_history[p.comfort_history.length - 1]
      if (lastComfort < 3) {
        patternWeakCount[p.pattern] = (patternWeakCount[p.pattern] ?? 0) + 1
      }
    }
    let weakestPattern: Pattern | null = null
    let maxWeak = 0
    for (const [pattern, count] of Object.entries(patternWeakCount) as [Pattern, number][]) {
      if (count > maxWeak) {
        maxWeak = count
        weakestPattern = pattern
      }
    }

    // Next upcoming review date (for empty queue message)
    const upcoming = problems
      .filter(p => p.next_review > today())
      .sort((a, b) => a.next_review.localeCompare(b.next_review))
    const nextReviewDate = upcoming.length > 0 ? upcoming[0].next_review : null

    // Average comfort per pattern (for analytics)
    const patternComforts: Partial<Record<Pattern, number[]>> = {}
    for (const p of problems) {
      if (p.comfort_history.length === 0) continue
      if (!patternComforts[p.pattern]) patternComforts[p.pattern] = []
      patternComforts[p.pattern]!.push(...p.comfort_history)
    }

    return {
      totalProblems,
      reviewsThisWeek,
      streak,
      weakestPattern,
      nextReviewDate,
      patternComforts,
    }
  }, [problems])
}
