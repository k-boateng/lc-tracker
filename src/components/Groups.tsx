import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchMyGroups, createGroup, joinGroup, leaveGroup, fetchLeaderboard,
} from '../utils/api'
import type { GroupInfo, LeaderboardEntry } from '../utils/api'
import { computeStreak, countLast7Days } from '../utils/stats'

interface RankedEntry extends LeaderboardEntry {
  streak: number
  reviewsThisWeek: number
  points: number
}

export function Groups() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<RankedEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [boardLoading, setBoardLoading] = useState(false)
  const [error, setError] = useState('')
  const [createName, setCreateName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const loadGroups = useCallback(async () => {
    try {
      const gs = await fetchMyGroups()
      setGroups(gs)
      setSelectedId(prev => (prev && gs.some(g => g.id === prev)) ? prev : (gs[0]?.id ?? null))
      setError('')
    } catch (e: any) {
      setError(e.message ?? 'Failed to load groups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGroups() }, [loadGroups])

  useEffect(() => {
    if (!selectedId) {
      setLeaderboard([])
      return
    }
    setBoardLoading(true)
    fetchLeaderboard(selectedId)
      .then(entries => {
        const ranked: RankedEntry[] = entries
          .map(e => ({
            ...e,
            streak: computeStreak(e.review_dates),
            // Older deployed RPC lacks these columns; fall back gracefully
            reviewsThisWeek: e.reviews_this_week ?? countLast7Days(e.review_dates),
            points: e.weekly_points ?? 0,
          }))
          .sort((a, b) =>
            b.points - a.points ||
            b.streak - a.streak ||
            b.total_reviews - a.total_reviews
          )
        setLeaderboard(ranked)
      })
      .catch((e: any) => setError(e.message ?? 'Failed to load leaderboard'))
      .finally(() => setBoardLoading(false))
  }, [selectedId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const g = await createGroup(createName.trim())
      setCreateName('')
      await loadGroups()
      setSelectedId(g.id)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create group')
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const gid = await joinGroup(joinCode.trim())
      setJoinCode('')
      await loadGroups()
      setSelectedId(gid)
    } catch (err: any) {
      setError(err.message ?? 'Failed to join group')
    } finally {
      setBusy(false)
    }
  }

  const handleLeave = async () => {
    if (!selectedId || !userId) return
    if (!confirmLeave) {
      setConfirmLeave(true)
      return
    }
    setConfirmLeave(false)
    try {
      await leaveGroup(selectedId, userId)
      setSelectedId(null)
      await loadGroups()
    } catch (e: any) {
      setError(e.message ?? 'Failed to leave group')
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const selected = groups.find(g => g.id === selectedId)

  if (loading) {
    return <div className="p-6 text-sm text-secondary">Loading groups…</div>
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h2 className="text-base font-medium text-primary">Groups</h2>

      {error && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/30 rounded px-3 py-2">{error}</div>
      )}

      {/* Create / Join */}
      <div className="grid grid-cols-2 gap-4">
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="text-xs text-secondary uppercase tracking-wider">Create a group</div>
          <input
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            placeholder="e.g. summer grind"
            maxLength={40}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary placeholder:text-secondary/40 focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !createName.trim()}
            className="w-full py-2 rounded bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            Create
          </button>
        </form>

        <form onSubmit={handleJoin} className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="text-xs text-secondary uppercase tracking-wider">Join a group</div>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Invite code"
            maxLength={6}
            className="w-full bg-bg border border-border rounded px-2 py-1.5 text-sm text-primary placeholder:text-secondary/40 focus:outline-none focus:border-accent font-mono tracking-widest"
          />
          <button
            type="submit"
            disabled={busy || joinCode.trim().length < 6}
            className="w-full py-2 rounded border border-accent/40 text-accent text-sm font-medium hover:bg-accent/10 transition-colors disabled:opacity-40"
          >
            Join
          </button>
        </form>
      </div>

      {/* Group selector (if multiple) */}
      {groups.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                g.id === selectedId
                  ? 'bg-accent/15 text-accent border border-accent/30'
                  : 'text-secondary border border-border hover:text-primary'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Selected group */}
      {selected ? (
        <section className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm text-primary font-medium">{selected.name}</div>
              <div className="text-xs text-secondary mt-0.5">
                {leaderboard.length} member{leaderboard.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={() => copyCode(selected.invite_code)}
              className="px-3 py-1.5 rounded border border-border text-xs text-secondary hover:text-primary hover:border-secondary transition-colors font-mono tracking-widest"
              title="Copy invite code"
            >
              {copied ? 'Copied!' : selected.invite_code}
            </button>
            <button
              onClick={handleLeave}
              onBlur={() => setConfirmLeave(false)}
              className={`px-3 py-1.5 rounded border text-xs transition-colors ${
                confirmLeave
                  ? 'border-danger bg-danger text-white'
                  : 'border-danger/40 text-danger hover:bg-danger/10'
              }`}
            >
              {confirmLeave ? 'Confirm' : 'Leave'}
            </button>
          </div>

          {boardLoading ? (
            <div className="text-sm text-secondary text-center py-8">loading leaderboard…</div>
          ) : (
            <>
              {(() => {
                const meIdx = leaderboard.findIndex(e => e.user_id === userId)
                if (meIdx === -1 || leaderboard.length < 2) return null
                const me = leaderboard[meIdx]
                if (meIdx === 0) {
                  const gap = me.points - leaderboard[1].points
                  return (
                    <div className="px-4 py-2 border-b border-border text-xs text-success">
                      ❯ you're leading — {leaderboard[1].username} is {gap} pts behind
                    </div>
                  )
                }
                const above = leaderboard[meIdx - 1]
                return (
                  <div className="px-4 py-2 border-b border-border text-xs text-warning">
                    ❯ {above.points - me.points} pts behind {above.username} — review to close the gap
                  </div>
                )
              })()}
              <table className="w-full text-sm border-collapse">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs text-secondary font-medium w-10">#</th>
                    <th className="text-left px-3 py-2.5 text-xs text-secondary font-medium">member</th>
                    <th className="text-right px-3 py-2.5 text-xs text-secondary font-medium">pts / wk</th>
                    <th className="text-right px-3 py-2.5 text-xs text-secondary font-medium">streak</th>
                    <th className="text-right px-3 py-2.5 text-xs text-secondary font-medium">reviews / wk</th>
                    <th className="text-right px-4 py-2.5 text-xs text-secondary font-medium">solved</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => {
                    const isMe = entry.user_id === userId
                    return (
                      <tr
                        key={entry.user_id}
                        className={`border-b border-border last:border-b-0 ${isMe ? 'bg-accent/5' : ''}`}
                      >
                        <td className={`px-4 py-2.5 font-display text-xs ${i === 0 && entry.points > 0 ? 'text-warning font-bold' : 'text-secondary'}`}>
                          {i + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {entry.avatar_url ? (
                              <img src={entry.avatar_url} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px]">
                                {entry.username[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className={`text-xs ${isMe ? 'text-accent' : 'text-primary'}`}>
                              {entry.username}{isMe ? ' (you)' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-display font-bold text-accent">{entry.points}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={entry.streak > 2 ? 'text-warning' : 'text-primary'}>
                            {entry.streak === 0 ? '—' : `${entry.streak}d`}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-primary">{entry.reviewsThisWeek}</td>
                        <td className="px-4 py-2.5 text-right text-primary">{entry.total_problems}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 border-t border-border text-xs text-secondary/70">
                pts: easy 10 · medium 20 · hard 30 — each problem scores once per day, +5 per active day
              </div>
            </>
          )}
        </section>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-lg">
          <div className="text-primary font-medium mb-1">No groups yet</div>
          <div className="text-sm text-secondary">
            Create one and share the invite code with friends, or join with a code.
          </div>
        </div>
      )}
    </div>
  )
}
