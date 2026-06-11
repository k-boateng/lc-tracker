import { useMemo } from 'react'
import { toISO } from '../utils/dates'

interface Props {
  reviewsByDate: Record<string, number>
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CELL = 11
const GAP = 3
const STEP = CELL + GAP

export function ActivityHeatmap({ reviewsByDate }: Props) {
  const { weeks, monthMarkers, totalReviews } = useMemo(() => {
    // Build 52 full weeks ending today, starting on the most recent Sunday
    const now = new Date()
    const todayDow = now.getDay() // 0=Sun
    // Go back to fill 52 complete weeks: 52*7 - 1 days back from today, padded to start on Sunday
    const totalDays = 52 * 7
    const startOffset = totalDays - 1 + todayDow // how many days back the first Sunday is
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - (startOffset - todayDow) - (7 * 52 - 7))
    // Simpler: find the Sunday 52 weeks ago
    const gridStart = new Date(now)
    gridStart.setDate(gridStart.getDate() - todayDow - 7 * 51)

    const days: { date: string; count: number }[] = []
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      const iso = toISO(d)
      days.push({ date: iso, count: reviewsByDate[iso] ?? 0 })
    }

    // Group into 52 columns of 7 rows
    const weeks: typeof days[] = []
    for (let w = 0; w < 52; w++) {
      weeks.push(days.slice(w * 7, w * 7 + 7))
    }

    // Month label: for each week column, record the month if it's the first week that column contains days of that month
    const monthMarkers: { wi: number; label: string }[] = []
    let lastMonth = -1
    for (let wi = 0; wi < weeks.length; wi++) {
      // Use the first day of the week (Sunday) for month assignment
      const firstDay = new Date(weeks[wi][0].date + 'T00:00:00')
      const m = firstDay.getMonth()
      if (m !== lastMonth) {
        monthMarkers.push({ wi, label: MONTH_NAMES[m] })
        lastMonth = m
      }
    }

    const totalReviews = Object.values(reviewsByDate).reduce((a, b) => a + b, 0)
    return { weeks, monthMarkers, totalReviews }
  }, [reviewsByDate])

  const cellColor = (count: number): string => {
    if (count === 0) return 'var(--heatmap-empty)'
    if (count === 1) return '#155e75'
    if (count === 2) return '#0e7490'
    if (count <= 4) return '#22d3ee'
    return '#a5f3fc'
  }

  const gridWidth = 52 * STEP - GAP
  const gridHeight = 7 * STEP - GAP
  const dayLabelWidth = 28
  const monthLabelHeight = 16
  const svgWidth = dayLabelWidth + gridWidth
  const svgHeight = monthLabelHeight + gridHeight

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block', fontFamily: 'inherit' }}
        >
          {/* Month labels */}
          {monthMarkers.map(({ wi, label }) => (
            <text
              key={wi}
              x={dayLabelWidth + wi * STEP}
              y={11}
              style={{ fontSize: '10px', fill: 'var(--color-secondary, #888)' }}
            >
              {label}
            </text>
          ))}

          {/* Day-of-week labels: Mon, Wed, Fri */}
          {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, row) =>
            label ? (
              <text
                key={row}
                x={0}
                y={monthLabelHeight + row * STEP + CELL - 1}
                style={{ fontSize: '9px', fill: 'var(--color-secondary, #888)' }}
              >
                {label}
              </text>
            ) : null
          )}

          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((day, row) => {
              const isFuture = day.date > new Date().toISOString().split('T')[0]
              return (
                <rect
                  key={`${wi}-${row}`}
                  x={dayLabelWidth + wi * STEP}
                  y={monthLabelHeight + row * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  ry={2}
                  fill={isFuture ? 'transparent' : cellColor(day.count)}
                >
                  {day.date && !isFuture && (
                    <title>{day.date}: {day.count} review{day.count !== 1 ? 's' : ''}</title>
                  )}
                </rect>
              )
            })
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-secondary" style={{ fontSize: '11px' }}>
        <span>{totalReviews} reviews in the last year</span>
        <div className="flex items-center gap-1 ml-auto">
          <span>Less</span>
          {(['var(--heatmap-empty)', '#155e75', '#0e7490', '#22d3ee', '#a5f3fc'] as const).map((color, i) => (
            <svg key={i} width={CELL} height={CELL}>
              <rect x={0} y={0} width={CELL} height={CELL} rx={2} ry={2} fill={color} />
            </svg>
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
