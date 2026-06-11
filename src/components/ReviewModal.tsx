import { useState, useEffect, useRef } from 'react'
import type { Problem } from '../types'
import { ComfortRating } from './ComfortRating'

interface Props {
  problem: Problem
  onSubmit: (comfort: 1 | 2 | 3 | 4 | 5, timeSpent?: number, notes?: string) => void
  onClose: () => void
}

export function ReviewModal({ problem, onSubmit, onClose }: Props) {
  const [comfort, setComfort] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [notes, setNotes] = useState('')
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const handleSubmit = () => {
    if (!comfort) return
    const minutes = elapsed > 0 ? Math.round(elapsed / 60) : undefined
    onSubmit(comfort, minutes, notes.trim() || undefined)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-stretch md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-surface border border-border rounded-lg w-full md:max-w-lg p-6 space-y-5 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-lg text-primary">{problem.name}</div>
            {problem.leetcode_number && (
              <div className="text-sm text-secondary font-mono">#{problem.leetcode_number}</div>
            )}
          </div>
          <button onClick={onClose} className="text-secondary hover:text-primary text-lg">✕</button>
        </div>

        {/* Link */}
        {problem.url && (
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
          >
            Open problem ↗
          </a>
        )}

        {/* Prompt */}
        <div className="bg-bg rounded border border-border p-3 text-sm text-secondary">
          Solve this problem from scratch before rating your comfort.
        </div>

        {/* Timer */}
        <div className="flex items-center gap-3">
          <div className="font-mono text-xl text-primary">{formatTime(elapsed)}</div>
          <button
            onClick={() => setTimerRunning(r => !r)}
            className="text-xs px-3 py-1.5 rounded border border-border text-secondary hover:text-primary hover:border-secondary transition-colors"
          >
            {timerRunning ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start timer'}
          </button>
          {elapsed > 0 && !timerRunning && (
            <button
              onClick={() => { setElapsed(0); setTimerRunning(false) }}
              className="text-xs text-secondary/60 hover:text-secondary"
            >
              Reset
            </button>
          )}
        </div>

        {/* Comfort rating */}
        <div>
          <div className="text-xs text-secondary mb-2 uppercase tracking-wider">Comfort rating</div>
          <ComfortRating value={comfort} onChange={setComfort} />
        </div>

        {/* Notes */}
        <div>
          <div className="text-xs text-secondary mb-2 uppercase tracking-wider">Notes (optional)</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What did you get wrong? What was the key insight?"
            rows={3}
            className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-primary placeholder:text-secondary/50 resize-none focus:outline-none focus:border-accent"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded border border-border text-secondary hover:text-primary text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!comfort}
            className="flex-1 py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Submit Review
          </button>
        </div>
      </div>
    </div>
  )
}
