import { useState, useMemo } from 'react'
import type { Problem, Pattern } from '../types'
import { ALL_PATTERNS } from '../types'
import { DifficultyBadge } from './DifficultyBadge'
import { PatternTag } from './PatternTag'
import { ComfortDot } from './ComfortRating'
import { ProblemDetail } from './ProblemDetail'
import { formatDate, formatRelative } from '../utils/dates'

interface Props {
  problems: Problem[]
  onUpdate: (id: string, updates: Partial<Omit<Problem, 'id'>>) => void
  onDelete: (id: string) => void
  onReview: (id: string, comfort: 1|2|3|4|5, time?: number, notes?: string) => void
}

type SortKey = 'next_review' | 'date_added' | 'comfort' | 'difficulty'

const difficultyOrder = { Easy: 0, Medium: 1, Hard: 2 }

export function ProblemLibrary({ problems, onUpdate, onDelete, onReview }: Props) {
  const [search, setSearch] = useState('')
  const [filterPattern, setFilterPattern] = useState<Pattern | ''>('')
  const [filterDifficulty, setFilterDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | ''>('')
  const [filterSource, setFilterSource] = useState<'LeetCode' | 'Codeforces' | 'Other' | ''>('')
  const [filterNeedsWork, setFilterNeedsWork] = useState(false)
  const [sort, setSort] = useState<SortKey>('next_review')
  const [selected, setSelected] = useState<Problem | null>(null)

  const filtered = useMemo(() => {
    let list = [...problems]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.leetcode_number?.toString().includes(q)
      )
    }
    if (filterPattern) list = list.filter(p => p.pattern === filterPattern)
    if (filterDifficulty) list = list.filter(p => p.difficulty === filterDifficulty)
    if (filterSource) list = list.filter(p => p.source === filterSource)
    if (filterNeedsWork) {
      list = list.filter(p => {
        const last = p.comfort_history[p.comfort_history.length - 1]
        return last !== undefined && last < 3
      })
    }

    list.sort((a, b) => {
      if (sort === 'next_review') return a.next_review.localeCompare(b.next_review)
      if (sort === 'date_added') return b.date_added.localeCompare(a.date_added)
      if (sort === 'difficulty') return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
      if (sort === 'comfort') {
        const ac = a.comfort_history[a.comfort_history.length - 1] ?? 0
        const bc = b.comfort_history[b.comfort_history.length - 1] ?? 0
        return ac - bc
      }
      return 0
    })

    return list
  }, [problems, search, filterPattern, filterDifficulty, filterSource, filterNeedsWork, sort])

  // Keep selected in sync if problem was updated
  const selectedProblem = selected ? problems.find(p => p.id === selected.id) ?? null : null

  return (
    <div className="p-4 md:p-6 md:h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-primary">Problem Library</h2>
        <span className="text-sm text-secondary font-mono">{filtered.length} / {problems.length}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name or LC#..."
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm text-primary placeholder:text-secondary/50 focus:outline-none focus:border-accent w-full md:w-48"
        />
        <select
          value={filterPattern}
          onChange={e => setFilterPattern(e.target.value as any)}
          className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All patterns</option>
          {ALL_PATTERNS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select
          value={filterDifficulty}
          onChange={e => setFilterDifficulty(e.target.value as any)}
          className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All difficulties</option>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value as any)}
          className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
        >
          <option value="">All sources</option>
          <option>LeetCode</option>
          <option>Codeforces</option>
          <option>Other</option>
        </select>
        <button
          onClick={() => setFilterNeedsWork(f => !f)}
          className={`px-3 py-1.5 rounded border text-sm transition-colors ${
            filterNeedsWork
              ? 'border-danger/50 bg-danger/10 text-danger'
              : 'border-border text-secondary hover:text-primary'
          }`}
        >
          Needs work
        </button>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="bg-surface border border-border rounded px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent ml-auto"
        >
          <option value="next_review">Sort: Next review</option>
          <option value="date_added">Sort: Date added</option>
          <option value="comfort">Sort: Comfort</option>
          <option value="difficulty">Sort: Difficulty</option>
        </select>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {filtered.map(p => {
          const lastComfort = p.comfort_history[p.comfort_history.length - 1]
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="w-full text-left bg-surface border border-border px-4 py-3 space-y-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-primary">{p.name}</span>
                {p.leetcode_number && (
                  <span className="font-mono text-xs text-secondary">#{p.leetcode_number}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <PatternTag pattern={p.pattern} />
                <DifficultyBadge difficulty={p.difficulty} />
                {lastComfort !== undefined && <ComfortDot comfort={lastComfort} />}
                <span className="text-secondary ml-auto">{formatRelative(p.next_review)}</span>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-secondary text-sm border border-border bg-surface">
            No problems match your filters
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block flex-1 overflow-auto border border-border rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-surface border-b border-border">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs text-secondary font-medium">Problem</th>
              <th className="text-left px-3 py-2.5 text-xs text-secondary font-medium">Pattern</th>
              <th className="text-left px-3 py-2.5 text-xs text-secondary font-medium">Difficulty</th>
              <th className="text-left px-3 py-2.5 text-xs text-secondary font-medium">Comfort</th>
              <th className="text-left px-3 py-2.5 text-xs text-secondary font-medium">Next Review</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const lastComfort = p.comfort_history[p.comfort_history.length - 1]
              return (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`cursor-pointer border-b border-border hover:bg-surface transition-colors ${
                    i % 2 === 0 ? 'bg-bg' : 'bg-surface/50'
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-mono text-primary">{p.name}</div>
                    {p.leetcode_number && (
                      <div className="text-xs text-secondary font-mono">#{p.leetcode_number}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <PatternTag pattern={p.pattern} />
                  </td>
                  <td className="px-3 py-2.5">
                    <DifficultyBadge difficulty={p.difficulty} />
                  </td>
                  <td className="px-3 py-2.5">
                    {lastComfort !== undefined ? (
                      <div className="flex items-center gap-1.5">
                        <ComfortDot comfort={lastComfort} />
                        <span className="text-xs text-secondary font-mono">{lastComfort}/5</span>
                      </div>
                    ) : (
                      <span className="text-xs text-secondary">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-primary font-mono text-xs">{formatDate(p.next_review)}</div>
                    <div className="text-secondary text-xs">{formatRelative(p.next_review)}</div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-secondary">No problems match your filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedProblem && (
        <ProblemDetail
          problem={selectedProblem}
          onClose={() => setSelected(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onReview={(id, comfort, time, notes) => {
            onReview(id, comfort, time, notes)
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
