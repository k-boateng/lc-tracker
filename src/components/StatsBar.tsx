import type { Pattern } from '../types'

interface Props {
  totalProblems: number
  reviewsThisWeek: number
  streak: number
  weakestPattern: Pattern | null
}

export function StatsBar({ totalProblems, reviewsThisWeek, streak, weakestPattern }: Props) {
  return (
    <div className="grid grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border flex-shrink-0">
      <Stat label="Total Logged" value={totalProblems.toString()} />
      <Stat label="Reviewed This Week" value={reviewsThisWeek.toString()} />
      <Stat label="Streak" value={streak === 0 ? '—' : `${streak}d`} accent={streak > 2} />
      <Stat label="Weakest Pattern" value={weakestPattern ?? '—'} small />
    </div>
  )
}

function Stat({ label, value, accent, small }: {
  label: string
  value: string
  accent?: boolean
  small?: boolean
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="text-xs text-secondary mb-1">{label}</div>
      <div className={`font-mono font-medium ${small ? 'text-sm' : 'text-xl'} ${accent ? 'text-accent' : 'text-primary'}`}>
        {value}
      </div>
    </div>
  )
}
