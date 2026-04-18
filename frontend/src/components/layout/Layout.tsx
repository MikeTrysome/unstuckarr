import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — full height drawer on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-30 lg:static lg:z-auto transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        {/* Mobile top bar — hidden on lg+ */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-[var(--bd)] bg-[var(--bg-card)] lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <img src="/icon.svg" alt="Unstuckarr" className="w-6 h-6" />
          <span className="text-sm font-semibold text-white">Unstuckarr</span>
        </div>

        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
