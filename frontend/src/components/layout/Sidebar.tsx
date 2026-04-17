import { NavLink } from 'react-router-dom'
import { Activity, LayoutDashboard, List, ScrollText, Settings } from 'lucide-react'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/queue', label: 'Queue', icon: Activity },
  { to: '/events', label: 'Events', icon: List },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
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

      <div className="px-4 py-3 border-t border-[#2a2d3a]">
        <p className="text-xs text-slate-500">v0.1.0</p>
      </div>
    </aside>
  )
}
