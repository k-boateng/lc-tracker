import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { Problem, Review } from '../types'
import { getProblems, saveProblems } from '../utils/storage'
import { calculateNextReview } from '../utils/sm2'
import { today } from '../utils/dates'

export interface NewProblemData {
  name: string
  leetcode_number?: number
  url?: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  pattern: Problem['pattern']
  subpattern?: string
  source: 'LeetCode' | 'Codeforces' | 'Other'
  notes?: string
  initialComfort: 1 | 2 | 3 | 4 | 5
}

export function useProblems() {
  const [problems, setProblems] = useState<Problem[]>(() => getProblems())

  const persist = useCallback((updated: Problem[]) => {
    saveProblems(updated)
    setProblems(updated)
  }, [])

  const addProblem = useCallback((data: NewProblemData) => {
    const stub: Problem = {
      id: uuidv4(),
      name: data.name,
      leetcode_number: data.leetcode_number,
      url: data.url,
      difficulty: data.difficulty,
      pattern: data.pattern,
      subpattern: data.subpattern,
      source: data.source,
      date_added: today(),
      notes: data.notes,
      reviews: [],
      next_review: today(),
      interval: 0,
      ease_factor: 2.5,
      comfort_history: [],
    }
    const { interval, nextReview, easeFactor } = calculateNextReview(stub, data.initialComfort)
    const problem: Problem = {
      ...stub,
      interval,
      next_review: nextReview,
      ease_factor: easeFactor,
      comfort_history: [data.initialComfort],
      reviews: [{ date: today(), comfort: data.initialComfort }],
    }
    persist([...problems, problem])
    return problem
  }, [problems, persist])

  const updateProblem = useCallback((id: string, updates: Partial<Omit<Problem, 'id'>>) => {
    const updated = problems.map(p => p.id === id ? { ...p, ...updates } : p)
    persist(updated)
  }, [problems, persist])

  const deleteProblem = useCallback((id: string) => {
    persist(problems.filter(p => p.id !== id))
  }, [problems, persist])

  const logReview = useCallback((
    id: string,
    comfort: 1 | 2 | 3 | 4 | 5,
    time_spent_minutes?: number,
    notes?: string,
  ) => {
    const problem = problems.find(p => p.id === id)
    if (!problem) return

    const review: Review = { date: today(), comfort, time_spent_minutes, notes }
    const { interval, nextReview, easeFactor } = calculateNextReview(problem, comfort)

    const updated: Problem = {
      ...problem,
      reviews: [...problem.reviews, review],
      interval,
      next_review: nextReview,
      ease_factor: easeFactor,
      comfort_history: [...problem.comfort_history, comfort],
    }
    persist(problems.map(p => p.id === id ? updated : p))
  }, [problems, persist])

  return { problems, addProblem, updateProblem, deleteProblem, logReview }
}
