export type Pattern =
  | 'Dynamic Programming'
  | 'Greedy'
  | 'Graphs'
  | 'Trees'
  | 'Backtracking'
  | 'Binary Search'
  | 'Two Pointers'
  | 'Sliding Window'
  | 'Heaps'
  | 'Stacks & Monotonic'
  | 'Intervals'
  | 'Linked Lists'
  | 'Arrays & Hashing'
  | 'Math & Number Theory'
  | 'Probability & Combinatorics'
  | 'Brain Teasers'
  | 'Other'

export const ALL_PATTERNS: Pattern[] = [
  'Dynamic Programming',
  'Greedy',
  'Graphs',
  'Trees',
  'Backtracking',
  'Binary Search',
  'Two Pointers',
  'Sliding Window',
  'Heaps',
  'Stacks & Monotonic',
  'Intervals',
  'Linked Lists',
  'Arrays & Hashing',
  'Math & Number Theory',
  'Probability & Combinatorics',
  'Brain Teasers',
  'Other',
]

export interface Review {
  date: string
  comfort: 1 | 2 | 3 | 4 | 5
  time_spent_minutes?: number
  notes?: string
}

export interface Problem {
  id: string
  name: string
  leetcode_number?: number
  url?: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  pattern: Pattern
  subpattern?: string
  source: 'LeetCode' | 'Codeforces' | 'Other'
  date_added: string
  notes?: string
  reviews: Review[]
  next_review: string
  interval: number
  ease_factor: number
  comfort_history: number[]
}

export interface AppSettings {
  darkMode: boolean
  dailyGoal: number
}
