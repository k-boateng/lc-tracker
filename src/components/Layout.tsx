import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'dashboard', short: 'dash' },
  { to: '/library', label: 'library', short: 'lib' },
  { to: '/analytics', label: 'analytics', short: 'stats' },
  { to: '/groups', label: 'groups', short: 'groups' },
  { to: '/settings', label: 'settings', short: 'config' },
]

export function Layout() {
  const { profile, signOut } = useAuth()

  const avatar = profile?.avatar_url ? (
    <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
  ) : (
    <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs flex-shrink-0">
      {profile?.username?.[0]?.toUpperCase() ?? '?'}
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row h-screen bg-bg text-primary overflow-hidden">
      {/* Mobile top header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface border-b border-border flex-shrink-0">
        <div className="font-display text-sm text-accent font-bold tracking-tight">~/lc-tracker</div>
        <div className="flex items-center gap-3">
          {avatar}
          <button
            onClick={signOut}
            title="Sign out"
            className="text-sm text-secondary hover:text-danger transition-colors"
          >
            ⏻
          </button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-48 flex-shrink-0 bg-surface border-r border-border flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-border">
          <div className="font-display text-sm text-accent font-bold tracking-tight">~/lc-tracker</div>
          <div className="text-xs text-secondary mt-1">spaced repetition</div>
        </div>
        <div className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-2 px-3 py-2 text-sm transition-colors
                ${isActive
                  ? 'bg-accent/10 text-accent border-l-2 border-accent'
                  : 'text-secondary hover:text-primary border-l-2 border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-xs ${isActive ? 'text-accent' : 'text-secondary/40'}`}>❯</span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
        <div className="p-3 border-t border-border flex items-center gap-2">
          {avatar}
          <div className="text-xs text-primary truncate flex-1">
            {profile?.username ?? '...'}
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="text-xs text-secondary hover:text-danger transition-colors flex-shrink-0"
          >
            ⏻
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-14 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border flex">
        {navItems.map(({ to, short }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2.5 text-xs transition-colors border-t-2
              ${isActive
                ? 'text-accent border-accent bg-accent/5'
                : 'text-secondary border-transparent'
              }`
            }
          >
            {short}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
