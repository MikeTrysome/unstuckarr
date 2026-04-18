import { NavLink, useNavigate } from 'react-router-dom'
import { Activity, LayoutDashboard, List, LogOut, ScrollText, Settings } from 'lucide-react'
import { clearToken } from '../../lib/auth'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/queue', label: 'Queue', icon: Activity },
  { to: '/events', label: 'Events', icon: List },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <aside className="w-56 shrink-0 bg-[#1a1d27] border-r border-[#2a2d3a] flex flex-col">
      <div className="px-5 py-5 border-b border-[#2a2d3a]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Activity size={14} className="text-white" />
          </div>
          <span className="font-semibold text-white text-sm tracking-wide">Unstuckarr</span>
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-0.5">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-[#2a2d3a] flex flex-col gap-1">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors w-full"
        >
          <LogOut size={16} />
          Log out
        </button>
        <p className="text-xs text-slate-600 px-3">v0.1.0</p>
      </div>
    </aside>
  )
}
