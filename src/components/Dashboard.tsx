import { useState, useEffect } from 'react'
import type { Problem } from '../types'
import { ALL_PATTERNS } from '../types'
import { DifficultyBadge } from './DifficultyBadge'
import { PatternTag } from './PatternTag'
import { ComfortDot, ComfortRating } from './ComfortRating'
import { ReviewModal } from './ReviewModal'
import { StatsBar } from './StatsBar'
import { useStats } from '../hooks/useStats'
import type { NewProblemData } from '../hooks/useProblems'
import { isDueToday, isOverdue, daysSince, formatDate } from '../utils/dates'
import { streakAtRisk } from '../utils/stats'

interface Props {
  problems: Problem[]
  onAddProblem: (data: NewProblemData) => void
  onLogReview: (id: string, comfort: 1|2|3|4|5, time?: number, notes?: string) => void
  openQuickLog: boolean
  onQuickLogOpened: () => void
}

const EMPTY_FORM: NewProblemData = {
  name: '',
  difficulty: 'Medium',
  pattern: 'Dynamic Programming',
  source: 'LeetCode',
  initialComfort: 3,
}

export function Dashboard({ problems, onAddProblem, onLogReview, openQuickLog, onQuickLogOpened }: Props) {
  const stats = useStats(problems)
  const [reviewTarget, setReviewTarget] = useState<Problem | null>(null)
  const [form, setForm] = useState<NewProblemData>(EMPTY_FORM)
  const [formExtra, setFormExtra] = useState({ lcNumber: '', url: '', subpattern: '', notes: '' })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (openQuickLog) {
      document.getElementById('quick-log-name')?.focus()
      onQuickLogOpened()
    }
  }, [openQuickLog, onQuickLogOpened])

  const dueProblems = problems
    .filter(p => isDueToday(p.next_review))
    .sort((a, b) => {
      const aOver = isOverdue(a.next_review)
      const bOver = isOverdue(b.next_review)
      if (aOver && !bOver) return -1
      if (!aOver && bOver) return 1
      return a.next_review.localeCompare(b.next_review)
    })

  const nextUpcoming = problems
    .filter(p => !isDueToday(p.next_review))
    .sort((a, b) => a.next_review.localeCompare(b.next_review))[0]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onAddProblem({
      ...form,
      leetcode_number: formExtra.lcNumber ? parseInt(formExtra.lcNumber) : undefined,
      url: formExtra.url.trim() || undefined,
      subpattern: formExtra.subpattern.trim() || undefined,
      notes: formExtra.notes.trim() || undefined,
    })
    setForm(EMPTY_FORM)
    setFormExtra({ lcNumber: '', url: '', subpattern: '', notes: '' })
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2000)
  }

  return (
    <div className="md:h-full flex flex-col p-4 md:p-6 gap-6">
      <div className="flex flex-col md:flex-row gap-6 md:flex-1 md:min-h-0">
        {/* Left: Review Queue */}
        <div className="md:flex-1 flex flex-col min-w-0 gap-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-primary">Today's Queue</h2>
            <span className="text-sm text-secondary font-mono">
              {dueProblems.length} due
            </span>
          </div>

          <StatsBar
            totalProblems={stats.totalProblems}
            reviewsThisWeek={stats.reviewsThisWeek}
            streak={stats.streak}
            weakestPattern={stats.weakestPattern}
          />

          {(() => {
            const risk = streakAtRisk(problems.flatMap(p => p.reviews.map(r => r.date)))
            return risk > 0 ? (
              <div className="border border-warning/40 bg-warning/10 text-warning text-xs px-4 py-2.5">
                ❯ your {risk}d streak dies at midnight — review one problem to keep it alive
              </div>
            ) : null
          })()}

          {dueProblems.length === 0 ? (
            <div className="md:flex-1 flex flex-col items-center justify-center text-center py-12 bg-surface border border-border rounded-lg">
              <div className="text-2xl mb-2">✓</div>
              <div className="text-primary font-medium mb-1">All caught up!</div>
              {nextUpcoming ? (
                <div className="text-sm text-secondary">
                  Next review: <span className="font-mono text-primary">{formatDate(nextUpcoming.next_review)}</span>
                  {' '}— {nextUpcoming.name}
                </div>
              ) : (
                <div className="text-sm text-secondary">No problems scheduled</div>
              )}
            </div>
          ) : (
            <div className="md:flex-1 md:overflow-y-auto space-y-2 md:pr-1">
              {dueProblems.map(p => {
                const overdue = isOverdue(p.next_review)
                const lastComfort = p.comfort_history[p.comfort_history.length - 1]
                const daysSinceReview = p.reviews.length > 0
                  ? daysSince(p.reviews[p.reviews.length - 1].date)
                  : null

                return (
                  <div key={p.id} className="bg-surface border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {overdue && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-danger/20 text-danger border border-danger/30 font-mono">
                            OVERDUE
                          </span>
                        )}
                        <span className="font-mono text-sm text-primary truncate">{p.name}</span>
                        {p.leetcode_number && (
                          <span className="font-mono text-xs text-secondary">#{p.leetcode_number}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <PatternTag pattern={p.pattern} />
                        <DifficultyBadge difficulty={p.difficulty} />
                        {lastComfort && <ComfortDot comfort={lastComfort} />}
                        {daysSinceReview !== null && (
                          <span className="text-xs text-secondary">
                            {daysSinceReview === 0 ? 'reviewed today' : `${daysSinceReview}d ago`}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setReviewTarget(p)}
                      className="flex-shrink-0 px-3 py-1.5 bg-accent/10 border border-accent/40 text-accent text-sm hover:bg-accent/20 transition-colors"
                    >
                      review ↵
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Quick Log */}
        <div className="w-full md:w-72 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-medium text-primary">Log Problem</h2>
            <kbd className="text-xs px-1.5 py-0.5 border border-border rounded text-secondary font-mono">N</kbd>
          </div>

          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-4 space-y-3">
            {submitted && (
              <div className="text-xs text-success bg-success/10 border border-success/30 rounded px-2 py-1.5">
                Problem logged!
              </div>
            )}

            <div>
              <label className="text-xs text-secondary block mb-1">Problem name *</label>
              <input
                id="quick-log-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="e.g. Two Sum"
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary placeholder:text-secondary/40 focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-secondary block mb-1">LC #</label>
                <input
                  value={formExtra.lcNumber}
                  onChange={e => setFormExtra(f => ({ ...f, lcNumber: e.target.value }))}
                  placeholder="1"
                  type="number"
                  className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary placeholder:text-secondary/40 focus:outline-none focus:border-accent font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-secondary block mb-1">Difficulty *</label>
                <select
                  value={form.difficulty}
                  onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as any }))}
                  className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-secondary block mb-1">Pattern *</label>
              <select
                value={form.pattern}
                onChange={e => setForm(f => ({ ...f, pattern: e.target.value as any }))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
              >
                {ALL_PATTERNS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-secondary block mb-1">Subpattern</label>
              <input
                value={formExtra.subpattern}
                onChange={e => setFormExtra(f => ({ ...f, subpattern: e.target.value }))}
                placeholder="e.g. 2D DP"
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary placeholder:text-secondary/40 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-xs text-secondary block mb-1">Source</label>
              <select
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value as any }))}
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
              >
                <option>LeetCode</option>
                <option>Codeforces</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-secondary block mb-1">URL</label>
              <input
                value={formExtra.url}
                onChange={e => setFormExtra(f => ({ ...f, url: e.target.value }))}
                placeholder="https://leetcode.com/..."
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary placeholder:text-secondary/40 focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="text-xs text-secondary block mb-1">Initial comfort</label>
              <ComfortRating
                compact
                value={form.initialComfort}
                onChange={v => setForm(f => ({ ...f, initialComfort: v }))}
              />
            </div>

            <div>
              <label className="text-xs text-secondary block mb-1">Notes</label>
              <textarea
                value={formExtra.notes}
                onChange={e => setFormExtra(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Key approach, insight..."
                className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary placeholder:text-secondary/40 resize-none focus:outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Log Problem
            </button>
          </form>
        </div>
      </div>

      {/* Review modal */}
      {reviewTarget && (
        <ReviewModal
          problem={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={(comfort, time, notes) => {
            onLogReview(reviewTarget.id, comfort, time, notes)
            setReviewTarget(null)
          }}
        />
      )}
    </div>
  )
}
