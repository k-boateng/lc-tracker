// Ported from src/utils/dates.ts (today + addDays + isOverdue — that's
// all the extension needs). Keep in sync if the main app's date logic
// changes.

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function addDaysISO(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function isOverdueISO(nextReview) {
  return nextReview < todayISO()
}
