import { supabase } from '../lib/supabase'
import type { Problem, Review } from '../types'

// DB row shapes (snake_case matches Postgres; interval is reserved in PG, so the
// column is interval_days and we map it back to the frontend's `interval`)
interface ProblemRow {
  id: string
  user_id: string
  name: string
  leetcode_number: number | null
  url: string | null
  difficulty: 'Easy' | 'Medium' | 'Hard'
  pattern: string
  subpattern: string | null
  source: 'LeetCode' | 'Codeforces' | 'Other'
  date_added: string
  notes: string | null
  next_review: string
  interval_days: number
  ease_factor: number
  reviews: ReviewRow[]
}

interface ReviewRow {
  id: string
  problem_id: string
  date: string
  comfort: 1 | 2 | 3 | 4 | 5
  time_spent_minutes: number | null
  notes: string | null
  created_at: string
}

function rowToProblem(row: ProblemRow): Problem {
  const reviews: Review[] = [...row.reviews]
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
    .map(r => ({
      date: r.date,
      comfort: r.comfort,
      time_spent_minutes: r.time_spent_minutes ?? undefined,
      notes: r.notes ?? undefined,
    }))
  return {
    id: row.id,
    name: row.name,
    leetcode_number: row.leetcode_number ?? undefined,
    url: row.url ?? undefined,
    difficulty: row.difficulty,
    pattern: row.pattern as Problem['pattern'],
    subpattern: row.subpattern ?? undefined,
    source: row.source,
    date_added: row.date_added,
    notes: row.notes ?? undefined,
    reviews,
    next_review: row.next_review,
    interval: row.interval_days,
    ease_factor: Number(row.ease_factor),
    comfort_history: reviews.map(r => r.comfort),
  }
}

function problemToRow(p: Problem, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    leetcode_number: p.leetcode_number ?? null,
    url: p.url ?? null,
    difficulty: p.difficulty,
    pattern: p.pattern,
    subpattern: p.subpattern ?? null,
    source: p.source,
    date_added: p.date_added,
    notes: p.notes ?? null,
    next_review: p.next_review,
    interval_days: p.interval,
    ease_factor: p.ease_factor,
  }
}

export async function fetchProblems(): Promise<Problem[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('*, reviews(*)')
    .order('date_added', { ascending: true })
  if (error) throw error
  return (data as ProblemRow[]).map(rowToProblem)
}

export async function insertProblem(problem: Problem, userId: string): Promise<void> {
  const { error } = await supabase.from('problems').insert(problemToRow(problem, userId))
  if (error) throw error
  if (problem.reviews.length > 0) {
    const { error: revError } = await supabase.from('reviews').insert(
      problem.reviews.map(r => ({
        problem_id: problem.id,
        user_id: userId,
        date: r.date,
        comfort: r.comfort,
        time_spent_minutes: r.time_spent_minutes ?? null,
        notes: r.notes ?? null,
      }))
    )
    if (revError) throw revError
  }
}

export async function updateProblem(
  id: string,
  updates: Partial<Omit<Problem, 'id' | 'reviews' | 'comfort_history'>>
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (updates.name !== undefined) row.name = updates.name
  if (updates.leetcode_number !== undefined) row.leetcode_number = updates.leetcode_number ?? null
  if (updates.url !== undefined) row.url = updates.url ?? null
  if (updates.difficulty !== undefined) row.difficulty = updates.difficulty
  if (updates.pattern !== undefined) row.pattern = updates.pattern
  if (updates.subpattern !== undefined) row.subpattern = updates.subpattern ?? null
  if (updates.source !== undefined) row.source = updates.source
  if (updates.notes !== undefined) row.notes = updates.notes ?? null
  if (updates.next_review !== undefined) row.next_review = updates.next_review
  if (updates.interval !== undefined) row.interval_days = updates.interval
  if (updates.ease_factor !== undefined) row.ease_factor = updates.ease_factor
  if (Object.keys(row).length === 0) return
  const { error } = await supabase.from('problems').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteProblem(id: string): Promise<void> {
  const { error } = await supabase.from('problems').delete().eq('id', id)
  if (error) throw error
}

export async function insertReview(
  problemId: string,
  userId: string,
  review: Review,
  schedule: { interval: number; next_review: string; ease_factor: number }
): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    problem_id: problemId,
    user_id: userId,
    date: review.date,
    comfort: review.comfort,
    time_spent_minutes: review.time_spent_minutes ?? null,
    notes: review.notes ?? null,
  })
  if (error) throw error
  const { error: updError } = await supabase
    .from('problems')
    .update({
      interval_days: schedule.interval,
      next_review: schedule.next_review,
      ease_factor: schedule.ease_factor,
    })
    .eq('id', problemId)
  if (updError) throw updError
}

// Bulk import (localStorage migration + JSON backup restore).
// Upserts by id so re-running is safe.
export async function bulkImport(problems: Problem[], userId: string): Promise<void> {
  if (problems.length === 0) return
  const { error } = await supabase
    .from('problems')
    .upsert(problems.map(p => problemToRow(p, userId)), { onConflict: 'id' })
  if (error) throw error

  const reviewRows = problems.flatMap(p =>
    p.reviews.map(r => ({
      problem_id: p.id,
      user_id: userId,
      date: r.date,
      comfort: r.comfort,
      time_spent_minutes: r.time_spent_minutes ?? null,
      notes: r.notes ?? null,
    }))
  )
  if (reviewRows.length > 0) {
    // Clear existing reviews for these problems first so re-import doesn't duplicate
    const ids = problems.map(p => p.id)
    const { error: delError } = await supabase.from('reviews').delete().in('problem_id', ids)
    if (delError) throw delError
    const { error: revError } = await supabase.from('reviews').insert(reviewRows)
    if (revError) throw revError
  }
}

export async function deleteAllProblems(userId: string): Promise<void> {
  const { error } = await supabase.from('problems').delete().eq('user_id', userId)
  if (error) throw error
}

// ---- Profile ----

export async function isUsernameTaken(username: string, ownId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', ownId)
    .limit(1)
  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function claimUsername(userId: string, username: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ username, onboarded: true })
    .eq('id', userId)
  if (error) {
    if (error.code === '23505') throw new Error('That handle is taken')
    throw error
  }
}

export async function getEmailDigestEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('email_digest_enabled')
    .eq('id', userId)
    .single()
  if (error) return true // default on
  return data?.email_digest_enabled ?? true
}

export async function setEmailDigestEnabled(userId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ email_digest_enabled: enabled })
    .eq('id', userId)
  if (error) throw error
}

// ---- Groups ----

export interface GroupInfo {
  id: string
  name: string
  invite_code: string
}

export interface LeaderboardEntry {
  user_id: string
  username: string
  avatar_url: string | null
  total_problems: number
  total_reviews: number
  // null when the deployed RPC predates these columns
  reviews_this_week: number | null
  weekly_points: number | null
  prev_week_points: number | null
  total_points: number | null
  review_dates: string[]
}

export async function fetchMyGroups(): Promise<GroupInfo[]> {
  const { data, error } = await supabase.from('groups').select('id, name, invite_code')
  if (error) throw error
  return data as GroupInfo[]
}

export async function createGroup(name: string): Promise<GroupInfo> {
  const { data, error } = await supabase.rpc('create_group', { group_name: name })
  if (error) throw error
  return (Array.isArray(data) ? data[0] : data) as GroupInfo
}

export async function joinGroup(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group', { code })
  if (error) throw error
  return data as string
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function fetchLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_group_leaderboard', { gid: groupId })
  if (error) throw error
  return (data as LeaderboardEntry[]).map(e => ({
    ...e,
    total_problems: Number(e.total_problems),
    total_reviews: Number(e.total_reviews),
    reviews_this_week: e.reviews_this_week != null ? Number(e.reviews_this_week) : null,
    weekly_points: e.weekly_points != null ? Number(e.weekly_points) : null,
    prev_week_points: e.prev_week_points != null ? Number(e.prev_week_points) : null,
    total_points: e.total_points != null ? Number(e.total_points) : null,
    review_dates: e.review_dates ?? [],
  }))
}
