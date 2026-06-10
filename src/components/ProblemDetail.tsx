import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { Problem } from '../types'
import { DifficultyBadge } from './DifficultyBadge'
import { PatternTag } from './PatternTag'
import { ComfortDot } from './ComfortRating'
import { ReviewModal } from './ReviewModal'
import { formatDate, formatRelative } from '../utils/dates'

interface Props {
  problem: Problem
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Omit<Problem, 'id'>>) => void
  onDelete: (id: string) => void
  onReview: (id: string, comfort: 1 | 2 | 3 | 4 | 5, time?: number, notes?: string) => void
}

export function ProblemDetail({ problem, onClose, onUpdate, onDelete, onReview }: Props) {
  const [reviewOpen, setReviewOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editData, setEditData] = useState({
    name: problem.name,
    notes: problem.notes ?? '',
    url: problem.url ?? '',
    leetcode_number: problem.leetcode_number?.toString() ?? '',
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !reviewOpen) onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, reviewOpen])

  const sparkData = problem.comfort_history.map((v, i) => ({ i, v }))

  const handleSaveEdit = () => {
    onUpdate(problem.id, {
      name: editData.name.trim(),
      notes: editData.notes.trim() || undefined,
      url: editData.url.trim() || undefined,
      leetcode_number: editData.leetcode_number ? parseInt(editData.leetcode_number) : undefined,
    })
    setEditing(false)
  }

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(problem.id)
      onClose()
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4" onClick={onClose}>
        <div
          className="bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div className="space-y-1.5">
              {editing ? (
                <input
                  value={editData.name}
                  onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                  className="font-mono text-lg bg-bg border border-border rounded px-2 py-1 text-primary focus:outline-none focus:border-accent w-full"
                />
              ) : (
                <div className="font-mono text-lg text-primary">{problem.name}</div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {problem.leetcode_number && (
                  <span className="font-mono text-sm text-secondary">#{problem.leetcode_number}</span>
                )}
                <DifficultyBadge difficulty={problem.difficulty} />
                <PatternTag pattern={problem.pattern} />
                {problem.subpattern && (
                  <span className="text-xs text-secondary">{problem.subpattern}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-secondary hover:text-primary text-lg ml-4">✕</button>
          </div>

          <div className="p-5 space-y-5">
            {/* Edit fields */}
            {editing && (
              <div className="space-y-3 p-3 bg-bg rounded border border-border">
                <div>
                  <label className="text-xs text-secondary block mb-1">URL</label>
                  <input
                    value={editData.url}
                    onChange={e => setEditData(d => ({ ...d, url: e.target.value }))}
                    className="w-full bg-surface border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-xs text-secondary block mb-1">LC Number</label>
                  <input
                    value={editData.leetcode_number}
                    onChange={e => setEditData(d => ({ ...d, leetcode_number: e.target.value }))}
                    className="w-24 bg-surface border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
                    placeholder="322"
                  />
                </div>
              </div>
            )}

            {/* URL link */}
            {!editing && problem.url && (
              <a href={problem.url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                Open on {problem.source} ↗
              </a>
            )}

            {/* Sparkline */}
            {sparkData.length > 1 && (
              <div>
                <div className="text-xs text-secondary mb-2">Comfort over time</div>
                <ResponsiveContainer width="100%" height={48}>
                  <LineChart data={sparkData}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 3 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Notes */}
            <div>
              <div className="text-xs text-secondary mb-2 uppercase tracking-wider">Approach Notes</div>
              {editing ? (
                <textarea
                  value={editData.notes}
                  onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                  rows={4}
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-primary resize-none focus:outline-none focus:border-accent"
                  placeholder="Your approach, key insight, things to remember..."
                />
              ) : (
                <div className="text-sm text-primary bg-bg border border-border rounded px-3 py-2 min-h-[60px] whitespace-pre-wrap">
                  {problem.notes || <span className="text-secondary italic">No notes yet</span>}
                </div>
              )}
            </div>

            {/* Review history */}
            <div>
              <div className="text-xs text-secondary mb-2 uppercase tracking-wider">
                Review History ({problem.reviews.length})
              </div>
              <div className="space-y-1.5">
                {[...problem.reviews].reverse().map((r, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2 bg-bg rounded border border-border">
                    <ComfortDot comfort={r.comfort} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-primary">{formatDate(r.date)}</span>
                        {r.time_spent_minutes && (
                          <span className="text-secondary">{r.time_spent_minutes}m</span>
                        )}
                      </div>
                      {r.notes && <div className="text-xs text-secondary mt-0.5">{r.notes}</div>}
                    </div>
                    <span className="font-mono text-xs text-secondary">{r.comfort}/5</span>
                  </div>
                ))}
                {problem.reviews.length === 0 && (
                  <div className="text-sm text-secondary italic">No reviews yet</div>
                )}
              </div>
            </div>

            {/* Next review info */}
            <div className="text-xs text-secondary">
              Next review: <span className="text-primary font-mono">{formatDate(problem.next_review)}</span>
              {' '}({formatRelative(problem.next_review)})
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
            <button
              onClick={() => setReviewOpen(true)}
              className="flex-1 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Review Now
            </button>
            {editing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded bg-success/20 border border-success/40 text-success text-sm hover:bg-success/30 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded border border-border text-secondary text-sm hover:text-primary transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 rounded border border-border text-secondary text-sm hover:text-primary transition-colors"
              >
                Edit
              </button>
            )}
            <button
              onClick={handleDelete}
              className={`px-4 py-2 rounded border text-sm transition-colors ${
                confirmDelete
                  ? 'border-danger bg-danger text-white'
                  : 'border-border text-secondary hover:border-danger hover:text-danger'
              }`}
            >
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {reviewOpen && (
        <ReviewModal
          problem={problem}
          onClose={() => setReviewOpen(false)}
          onSubmit={(comfort, time, notes) => {
            onReview(problem.id, comfort, time, notes)
            setReviewOpen(false)
            onClose()
          }}
        />
      )}
    </>
  )
}
