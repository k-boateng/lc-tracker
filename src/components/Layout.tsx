import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⬛' },
  { to: '/library', label: 'Library', icon: '☰' },
  { to: '/analytics', label: 'Analytics', icon: '▦' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export function Layout() {
  return (
    <div className="flex h-screen bg-bg text-primary overflow-hidden">
      {/* Sidebar */}
      <nav className="w-48 flex-shrink-0 bg-surface border-r border-border flex flex-col">
        <div className="px-4 pt-5 pb-4 border-b border-border">
          <div className="font-mono text-sm text-accent font-medium">LC Tracker</div>
          <div className="text-xs text-secondary mt-0.5">spaced repetition</div>
        </div>
        <div className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-sans transition-colors
                ${isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-secondary hover:text-primary hover:bg-white/5'
                }`
              }
            >
              <span className="text-xs">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <div className="text-xs text-secondary/60 font-sans">
            All data in localStorage
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
