import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity,
  Bell,
  LayoutDashboard,
  List,
  LogOut,
  Moon,
  Network,
  ScrollText,
  Sliders,
  Sun,
  User,
} from 'lucide-react'
import { clearToken } from '../../lib/auth'
import { useTheme } from '../../hooks/useTheme'

const mainNav = [
  { to: '/',       label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/queue',  label: 'Queue',     icon: Activity },
  { to: '/events', label: 'Events',    icon: List },
  { to: '/logs',   label: 'Logs',      icon: ScrollText },
]

const settingsNav = [
  { to: '/connections',  label: 'Connections',  icon: Network },
  { to: '/detection',    label: 'Detection',    icon: Sliders },
  { to: '/notifications',label: 'Notifications',icon: Bell },
  { to: '/account',      label: 'Account',      icon: User },
]

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: React.ElementType; end?: boolean }) {
  return (
    <NavLink
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
  )
}

export function Sidebar() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <aside className="w-56 shrink-0 bg-[var(--bg-card)] border-r border-[var(--bd)] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[var(--bd)]">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Unstuckarr" className="w-7 h-7" />
          <span className="font-semibold text-white text-sm tracking-wide">Unstuckarr</span>
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        {/* Main navigation */}
        {mainNav.map(({ to, label, icon, end }) => (
          <NavItem key={to} to={to} label={label} icon={icon} end={end} />
        ))}

        {/* Settings section */}
        <div className="mt-4 mb-1 px-3">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-600">
            Settings
          </span>
        </div>
        {settingsNav.map(({ to, label, icon }) => (
          <NavItem key={to} to={to} label={label} icon={icon} />
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-[var(--bd)] flex flex-col gap-1">
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors w-full"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
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
