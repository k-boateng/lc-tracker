// Copied verbatim from src/types/index.ts (ALL_PATTERNS). Do not reorder,
// rename, or add to this list independently of the main app — the DB has
// no CHECK constraint on `pattern`, so a mismatched value here wouldn't
// fail the insert, it would just silently create a new, uncoordinated tag.
const ALL_PATTERNS = [
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
