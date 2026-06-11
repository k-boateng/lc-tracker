interface Props {
  value: 1 | 2 | 3 | 4 | 5 | null
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void
  disabled?: boolean
}

const labels = ['Blanked', 'Struggled', 'Shaky', 'Solid', 'Fluent']
// Tokyo Night comfort ramp: red -> orange -> amber -> green -> teal
export const COMFORT_COLORS = ['#f7768e', '#ff9e64', '#e0af68', '#9ece6a', '#73daca']

export function ComfortRating({ value, onChange, disabled }: Props) {
  return (
    <div className="flex gap-2">
      {labels.map((label, i) => {
        const rating = (i + 1) as 1 | 2 | 3 | 4 | 5
        const isSelected = value === rating
        const c = COMFORT_COLORS[i]
        return (
          <button
            key={rating}
            type="button"
            onClick={() => !disabled && onChange(rating)}
            disabled={disabled}
            style={
              isSelected
                ? { borderColor: c, backgroundColor: c, color: '#0b0e14' }
                : { borderColor: `${c}66`, color: c, backgroundColor: `${c}14` }
            }
            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 border text-xs transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-125'}
            `}
          >
            <span className="font-mono font-medium">{rating}</span>
            <span>{label}</span>
          </button>
        )
      })}
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
