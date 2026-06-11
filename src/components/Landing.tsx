import { useAuth } from '../contexts/AuthContext'

const mockBoard = [
  { rank: 1, name: 'dan', pts: 240, streak: '12d', you: false },
  { rank: 2, name: 'alex', pts: 220, streak: '9d', you: true },
  { rank: 3, name: 'sam', pts: 165, streak: '4d', you: false },
  { rank: 4, name: 'jordan', pts: 90, streak: '—', you: false },
]

export function Landing() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-bg text-primary font-mono">
      {/* Top bar */}
      <header className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="font-display text-sm text-accent font-bold tracking-tight">~/lc-tracker</div>
        <button
          onClick={signInWithGoogle}
          className="text-xs text-secondary hover:text-accent transition-colors"
        >
          sign in ❯
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6">
        {/* Hero */}
        <section className="pt-12 md:pt-20 pb-12 text-center">
          <h1 className="font-display font-bold text-2xl md:text-4xl tracking-tight text-primary leading-tight">
            grind leetcode<br />
            <span className="text-accent">with your friends</span>
          </h1>
          <p className="text-sm text-secondary mt-5 max-w-md mx-auto leading-relaxed">
            <span className="text-accent">❯</span> spaced repetition schedules your reviews.
            a weekly leaderboard keeps everyone honest.
          </p>
          <button
            onClick={signInWithGoogle}
            className="mt-8 inline-flex items-center gap-2.5 px-6 py-3 border border-accent/40 bg-accent/5 text-sm text-accent hover:bg-accent/15 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23zM5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            start grinding — free ↵
          </button>
          <div className="text-xs text-secondary/60 mt-3">sign in with google · no setup</div>
        </section>

        {/* Mock leaderboard */}
        <section className="pb-14">
          <div className="bg-surface border border-border max-w-lg mx-auto">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
              <span className="text-xs text-secondary ml-2">summer grind — week 24</span>
              <span className="text-xs text-warning ml-auto">resets in 2d 14h</span>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-secondary font-medium w-10">#</th>
                  <th className="text-left px-3 py-2 text-xs text-secondary font-medium">member</th>
                  <th className="text-right px-3 py-2 text-xs text-secondary font-medium">pts / wk</th>
                  <th className="text-right px-4 py-2 text-xs text-secondary font-medium">streak</th>
                </tr>
              </thead>
              <tbody>
                {mockBoard.map(r => (
                  <tr key={r.rank} className={`border-b border-border last:border-b-0 ${r.you ? 'bg-accent/5' : ''}`}>
                    <td className={`px-4 py-2.5 font-display text-xs ${r.rank === 1 ? 'text-warning font-bold' : 'text-secondary'}`}>{r.rank}</td>
                    <td className={`px-3 py-2.5 text-xs ${r.you ? 'text-accent' : 'text-primary'}`}>{r.name}{r.you ? ' (you)' : ''}</td>
                    <td className="px-3 py-2.5 text-right font-display font-bold text-accent">{r.pts}</td>
                    <td className="px-4 py-2.5 text-right text-primary">{r.streak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-border text-xs text-warning">
              ❯ dan passed you — 20 pts behind. review to close the gap
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="pb-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="bg-surface border border-border p-5">
            <div className="text-accent text-sm mb-2">❯ spaced repetition</div>
            <p className="text-xs text-secondary leading-relaxed">
              rate your comfort 1–5 after each solve. the SM-2 algorithm schedules the next review right before you'd forget.
            </p>
          </div>
          <div className="bg-surface border border-border p-5">
            <div className="text-accent text-sm mb-2">❯ weekly rounds</div>
            <p className="text-xs text-secondary leading-relaxed">
              points reset every monday. easy 10 · medium 20 · hard 30, anti-gaming built in. newcomers always have a shot.
            </p>
          </div>
          <div className="bg-surface border border-border p-5">
            <div className="text-accent text-sm mb-2">❯ accountability</div>
            <p className="text-xs text-secondary leading-relaxed">
              streaks die publicly at midnight. one email a day, max, when yours is at risk or a friend passes you.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="pb-10 text-center text-xs text-secondary/60 space-y-2">
          <div>
            <button onClick={signInWithGoogle} className="text-accent hover:underline">start grinding ↵</button>
          </div>
          <div>
            free · your data stays yours ·{' '}
            <a href="https://github.com/k-boateng/lc-tracker" target="_blank" rel="noopener noreferrer" className="hover:text-secondary underline">
              source on github
            </a>
          </div>
        </footer>
      </main>
    </div>
  )
}
