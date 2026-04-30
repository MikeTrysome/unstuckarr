import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity,
  Bell,
  LayoutDashboard,
  List,
  LogOut,
  Monitor,
  Moon,
  Network,
  ScrollText,
  Sliders,
  Sun,
  User,
  X,
} from 'lucide-react'
import { clearToken } from '../../lib/auth'
import { useTheme } from '../../hooks/useTheme'

const THEME_META = {
  dark:   { Icon: Moon,    label: 'Dark mode' },
  light:  { Icon: Sun,     label: 'Light mode' },
  system: { Icon: Monitor, label: 'System' },
} as const

const mainNav = [
  { to: '/',       label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/queue',  label: 'Queue',     icon: Activity },
  { to: '/events', label: 'Events',    icon: List },
  { to: '/logs',   label: 'Logs',      icon: ScrollText },
]

const settingsNav = [
  { to: '/connections',   label: 'Connections',   icon: Network },
  { to: '/detection',     label: 'Detection',     icon: Sliders },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/account',       label: 'Account',       icon: User },
]

function NavItem({
  to, label, icon: Icon, end, onClick,
}: {
  to: string
  label: string
  icon: React.ElementType
  end?: boolean
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
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

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const { theme, cycle } = useTheme()
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    fetch('/health')
      .then((r) => r.json())
      .then((d) => setVersion(d.version ? String(d.version).slice(0, 7) : ''))
      .catch(() => {})
  }, [])

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  const { Icon: ThemeIcon, label: themeLabel } = THEME_META[theme]

  return (
    <aside className="w-56 h-full bg-[var(--bg-card)] border-r border-[var(--bd)] flex flex-col">
      <div className="px-5 py-5 border-b border-[var(--bd)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="Unstuckarr" className="w-7 h-7" />
          <span className="font-semibold text-white text-sm tracking-wide">Unstuckarr</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        {mainNav.map(({ to, label, icon, end }) => (
          <NavItem key={to} to={to} label={label} icon={icon} end={end} onClick={onClose} />
        ))}

        <div className="mt-4 mb-1 px-3">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-600">
            Settings
          </span>
        </div>
        {settingsNav.map(({ to, label, icon }) => (
          <NavItem key={to} to={to} label={label} icon={icon} onClick={onClose} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-[var(--bd)] flex flex-col gap-1">
        <button
          onClick={cycle}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors w-full"
        >
          <ThemeIcon size={16} />
          {themeLabel}
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors w-full"
        >
          <LogOut size={16} />
          Log out
        </button>
        {version && <p className="text-xs text-slate-600 px-3 font-mono">{version}</p>}
      </div>
    </aside>
  )
}
