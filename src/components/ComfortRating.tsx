interface Props {
  value: 1 | 2 | 3 | 4 | 5 | null
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void
  disabled?: boolean
  // Number-only squares for narrow containers (quick log sidebar)
  compact?: boolean
}

const labels = ['Blanked', 'Struggled', 'Shaky', 'Solid', 'Fluent']
// Tokyo Night comfort ramp: red -> orange -> amber -> green -> teal
export const COMFORT_COLORS = ['#f7768e', '#ff9e64', '#e0af68', '#9ece6a', '#73daca']

export function ComfortRating({ value, onChange, disabled, compact }: Props) {
  return (
    <div>
      <div className={`grid grid-cols-5 ${compact ? 'gap-1' : 'gap-2'}`}>
        {labels.map((label, i) => {
          const rating = (i + 1) as 1 | 2 | 3 | 4 | 5
          const isSelected = value === rating
          const c = COMFORT_COLORS[i]
          return (
            <button
              key={rating}
              type="button"
              title={label}
              onClick={() => !disabled && onChange(rating)}
              disabled={disabled}
              style={
                isSelected
                  ? { borderColor: c, backgroundColor: c, color: '#0b0e14' }
                  : { borderColor: `${c}66`, color: c, backgroundColor: `${c}14` }
              }
              className={`min-w-0 flex flex-col items-center gap-1 border text-xs transition-all
                ${compact ? 'py-1.5 px-0' : 'py-2 px-1'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-125'}
              `}
            >
              <span className="font-mono font-medium">{rating}</span>
              {!compact && <span className="truncate max-w-full">{label}</span>}
            </button>
          )
        })}
      </div>
      {compact && (
        <div className="text-xs mt-1.5 h-4" style={{ color: value ? COMFORT_COLORS[value - 1] : undefined }}>
          {value ? `${value} — ${labels[value - 1].toLowerCase()}` : ''}
        </div>
      )}
    </div>
  )
}

export function ComfortDot({ comfort }: { comfort: number }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ backgroundColor: COMFORT_COLORS[comfort - 1] }}
      title={`Comfort: ${comfort}`}
    />
  )
}
