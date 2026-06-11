import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'dashboard' },
  { to: '/library', label: 'library' },
  { to: '/analytics', label: 'analytics' },
  { to: '/groups', label: 'groups' },
  { to: '/settings', label: 'settings' },
]

export function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="flex h-screen bg-bg text-primary overflow-hidden">
      {/* Sidebar */}
      <nav className="w-48 flex-shrink-0 bg-surface border-r border-border flex flex-col">
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
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs flex-shrink-0">
              {profile?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
