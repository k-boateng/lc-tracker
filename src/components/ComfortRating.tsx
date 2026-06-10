interface Props {
  value: 1 | 2 | 3 | 4 | 5 | null
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void
  disabled?: boolean
}

const labels = ['Blanked', 'Struggled', 'Shaky', 'Solid', 'Fluent']
const colors = [
  'border-danger text-danger bg-danger/10 hover:bg-danger/20',
  'border-orange-500 text-orange-500 bg-orange-500/10 hover:bg-orange-500/20',
  'border-warning text-warning bg-warning/10 hover:bg-warning/20',
  'border-lime-500 text-lime-500 bg-lime-500/10 hover:bg-lime-500/20',
  'border-success text-success bg-success/10 hover:bg-success/20',
]
const selectedColors = [
  'border-danger bg-danger text-white',
  'border-orange-500 bg-orange-500 text-white',
  'border-warning bg-warning text-white',
  'border-lime-500 bg-lime-500 text-white',
  'border-success bg-success text-white',
]

export function ComfortRating({ value, onChange, disabled }: Props) {
  return (
    <div className="flex gap-2">
      {labels.map((label, i) => {
        const rating = (i + 1) as 1 | 2 | 3 | 4 | 5
        const isSelected = value === rating
        return (
          <button
            key={rating}
            type="button"
            onClick={() => !disabled && onChange(rating)}
            disabled={disabled}
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded border text-xs transition-all
              ${isSelected ? selectedColors[i] : colors[i]}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className="font-mono font-medium">{rating}</span>
            <span className="font-sans">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ComfortDot({ comfort }: { comfort: number }) {
  const dotColors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e']
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ backgroundColor: dotColors[comfort - 1] }}
      title={`Comfort: ${comfort}`}
    />
  )
}
