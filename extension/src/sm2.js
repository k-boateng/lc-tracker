// Ported straight from src/utils/sm2.ts. Keep in sync with the main app —
// this is the only thing standing between the extension and a schedule
// that silently drifts from what the web app would have computed.
function calculateNextReview(problem, rating) {
  const isFirstReview = problem.reviews.length === 0
  const prevInterval = problem.interval

  let interval
  if (rating < 3) {
    interval = 1
  } else if (rating === 3) {
    interval = 2
  } else if (rating === 4) {
    interval = isFirstReview ? 3 : Math.round(prevInterval * 1.5)
  } else {
    interval = isFirstReview ? 7 : Math.round(prevInterval * 2.5)
  }

  interval = Math.min(30, Math.max(1, interval))

  const r = rating
  const newEF = Math.max(1.3, problem.ease_factor + (0.1 - (5 - r) * (0.08 + (5 - r) * 0.02)))

  return {
    interval,
    nextReview: addDaysISO(todayISO(), interval),
    easeFactor: Math.round(newEF * 100) / 100,
  }
}
