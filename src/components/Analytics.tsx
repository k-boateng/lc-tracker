import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { Problem } from '../types'
import { today, toISO } from '../utils/dates'
import { ComfortDot } from './ComfortRating'
import { ActivityHeatmap } from './Heatmap'

interface Props {
  problems: Problem[]
}

export function Analytics({ problems }: Props) {
  // Pattern labels need less reserved width on phones or the bars vanish
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768
  const patternLabelWidth = isNarrow ? 92 : 120
  const {
    dayCounts,
    patternData,
    volumeData,
    forecastData,
    weakestProblems,
  } = useMemo(() => {
    // Heatmap: review counts per day (last 90 days)
    const dayCounts: Record<string, number> = {}
    for (const p of problems) {
      for (const r of p.reviews) {
        dayCounts[r.date] = (dayCounts[r.date] ?? 0) + 1
      }
    }

    // Pattern breakdown: avg comfort per pattern
    const patternAcc: Record<string, number[]> = {}
    for (const p of problems) {
      if (p.comfort_history.length === 0) continue
      if (!patternAcc[p.pattern]) patternAcc[p.pattern] = []
      patternAcc[p.pattern].push(...p.comfort_history)
    }
    const patternData = Object.entries(patternAcc)
      .map(([pattern, vals]) => ({
        pattern,
        avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
      }))
      .sort((a, b) => a.avg - b.avg)

    // Review volume: per day last 30 days
    const volumeData: { date: string; label: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today() + 'T00:00:00')
      d.setDate(d.getDate() - i)
      const iso = toISO(d)
      volumeData.push({
        date: iso,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: dayCounts[iso] ?? 0,
      })
    }

    // Due forecast: next 7 days
    const forecastData: { label: string; count: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(today() + 'T00:00:00')
      d.setDate(d.getDate() + i)
      const iso = toISO(d)
      const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      const count = problems.filter(p => p.next_review === iso).length
      forecastData.push({ label, count })
    }

    // Weakest 10 problems: lowest avg comfort_history
    const weakestProblems = [...problems]
      .filter(p => p.comfort_history.length > 0)
      .map(p => ({
        ...p,
        avgComfort: p.comfort_history.reduce((a, b) => a + b, 0) / p.comfort_history.length,
      }))
      .sort((a, b) => a.avgComfort - b.avgComfort)
      .slice(0, 10)

    return { dayCounts, patternData, volumeData, forecastData, weakestProblems }
  }, [problems])

  const comfortColor = (avg: number) => {
    if (avg < 2) return '#f7768e'
    if (avg < 3) return '#ff9e64'
    if (avg < 4) return '#e0af68'
    if (avg < 4.5) return '#9ece6a'
    return '#73daca'
  }

  const tooltipStyle = {
    backgroundColor: 'rgb(var(--c-surface))',
    border: '1px solid rgb(var(--c-border))',
    borderRadius: '0',
    color: 'rgb(var(--c-primary))',
    fontSize: '12px',
    fontFamily: 'IBM Plex Mono, monospace',
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      <h2 className="text-base font-medium text-primary">Analytics</h2>

      {/* Heatmap */}
      <section>
        <div className="text-xs text-secondary uppercase tracking-wider mb-3">Review Activity (last year)</div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <ActivityHeatmap reviewsByDate={dayCounts} />
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pattern breakdown */}
        <section>
          <div className="text-xs text-secondary uppercase tracking-wider mb-3">Avg Comfort by Pattern</div>
          <div className="bg-surface border border-border rounded-lg p-4">
            {patternData.length === 0 ? (
              <div className="text-sm text-secondary text-center py-8">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, patternData.length * 28)}>
                <BarChart data={patternData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: '#545c7e' }} />
                  <YAxis type="category" dataKey="pattern" tick={{ fontSize: isNarrow ? 10 : 11, fill: '#545c7e' }} width={patternLabelWidth} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [Number(v).toFixed(1), 'Avg comfort']}
                  />
                  <Bar dataKey="avg" radius={[0, 3, 3, 0]}>
                    {patternData.map((d, i) => (
                      <Cell key={i} fill={comfortColor(d.avg)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Due forecast */}
        <section>
          <div className="text-xs text-secondary uppercase tracking-wider mb-3">Due in Next 7 Days</div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={forecastData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#545c7e' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#545c7e' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v), 'Problems due']} />
                <Bar dataKey="count" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Review volume */}
      <section>
        <div className="text-xs text-secondary uppercase tracking-wider mb-3">Review Volume (last 30 days)</div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={volumeData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#545c7e' }}
                interval={4}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#545c7e' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v), 'Reviews']} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Weakest problems */}
      <section>
        <div className="text-xs text-secondary uppercase tracking-wider mb-3">10 Weakest Problems</div>
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-secondary font-medium">Problem</th>
                <th className="hidden md:table-cell text-left px-3 py-2.5 text-xs text-secondary font-medium">Pattern</th>
                <th className="text-left px-3 py-2.5 text-xs text-secondary font-medium">Comfort</th>
                <th className="text-right md:text-left px-3 py-2.5 text-xs text-secondary font-medium">Reviews</th>
              </tr>
            </thead>
            <tbody>
              {weakestProblems.map((p, i) => (
                <tr key={p.id} className={`border-b border-border ${i % 2 === 0 ? 'bg-bg' : 'bg-surface/50'}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-mono text-primary">{p.name}</div>
                    {p.leetcode_number && (
                      <div className="text-xs text-secondary font-mono">#{p.leetcode_number}</div>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-3 py-2.5 text-xs text-secondary">{p.pattern}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <ComfortDot comfort={Math.round(p.avgComfort)} />
                      <span className="font-mono text-xs text-primary">{p.avgComfort.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-secondary font-mono text-right md:text-left">{p.reviews.length}</td>
                </tr>
              ))}
              {weakestProblems.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-secondary">No data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
