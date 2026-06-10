interface Props {
  difficulty: 'Easy' | 'Medium' | 'Hard'
  size?: 'sm' | 'md'
}

const colors = {
  Easy: 'text-success border-success/40 bg-success/10',
  Medium: 'text-warning border-warning/40 bg-warning/10',
  Hard: 'text-danger border-danger/40 bg-danger/10',
}

export function DifficultyBadge({ difficulty, size = 'sm' }: Props) {
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'
  return (
    <span className={`font-mono border rounded ${sizeClass} ${colors[difficulty]}`}>
      {difficulty}
    </span>
  )
}
