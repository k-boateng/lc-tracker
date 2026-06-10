import type { Pattern } from '../types'

interface Props {
  pattern: Pattern
}

export function PatternTag({ pattern }: Props) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded border border-accent/40 bg-accent/10 text-accent font-sans">
      {pattern}
    </span>
  )
}
