export function toISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function today(): string {
  return toISO(new Date())
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
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
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
