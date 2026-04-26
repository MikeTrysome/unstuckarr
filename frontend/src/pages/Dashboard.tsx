import { useState } from 'react'
import { api } from '../lib/api'
import type { DashboardData } from '../types'
import { usePolling } from '../hooks/usePolling'
import { CheckCircle, RefreshCw, XCircle } from 'lucide-react'

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

const INSTANCES = ['Sonarr', 'Sonarr-4K', 'Radarr', 'Radarr-4K']

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const load = async () => {
    try {
      setData(await api.dashboard.get())
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }

  usePolling(load, 15_000)

  const triggerRun = async (fn: () => Promise<unknown>) => {
    setRunning(true)
    await fn().catch(() => {})
    // Poll more frequently after triggering a run to pick up the result quickly
    setTimeout(() => load(), 2000)
    setTimeout(() => load(), 5000)
    setTimeout(() => { load(); setRunning(false) }, 10_000)
  }

  const triggerDryRun  = () => triggerRun(api.actions.dryRun)
  const triggerExecute = () => triggerRun(api.actions.execute)

  if (error) return <p className="text-red-400 text-sm">{error}</p>
  if (!data) return <p className="text-slate-500 text-sm">Loading...</p>

  const lastRun = data.last_run
  const statusIcon = lastRun?.status === 'success'
    ? <CheckCircle size={14} className="text-green-400" />
    : lastRun?.status === 'error'
    ? <XCircle size={14} className="text-red-400" />
    : <RefreshCw size={14} className="text-amber-400" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Overview of the last 24 hours</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerDryRun}
            disabled={running}
            className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50"
          >
            Dry run
          </button>
          <button
            onClick={triggerExecute}
            disabled={running}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            {running ? 'Running...' : 'Run now'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Removed (24h)" value={data.total_removed_24h} color="text-green-400" />
        <StatCard label="Stuck found (24h)" value={data.total_stuck_24h} color="text-amber-400" />
        <StatCard
          label="Last run"
          value={lastRun?.started_at ? new Date(lastRun.started_at).toLocaleString() : '—'}
          sub={lastRun?.status ?? undefined}
        />
        <StatCard
          label="Next run"
          value={data.scheduler_enabled ? (data.next_run_at ? new Date(data.next_run_at).toLocaleString() : '—') : 'Disabled'}
          sub={!data.scheduler_enabled ? 'Scheduler is turned off in Detection settings' : undefined}
        />
      </div>

      {/* Per instance */}
      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-3">Per instance (24h)</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {INSTANCES.map((name) => {
            const inst = data.by_instance[name] ?? { removed: 0, dry_run: 0 }
            return (
              <div key={name} className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] p-4">
                <p className="text-sm font-medium text-white">{name}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Removed</span>
                    <span className="text-green-400 font-medium">{inst.removed}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Dry run</span>
                    <span className="text-amber-400 font-medium">{inst.dry_run}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Last run detail */}
      {lastRun?.run_id && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] p-5">
          <div className="flex items-center gap-2 mb-3">
            {statusIcon}
            <h2 className="text-sm font-medium text-white">Last run</h2>
            {lastRun?.dry_run && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                dry run
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs">Stuck found</p>
              <p className="text-white font-medium">{lastRun.total_stuck ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Removed</p>
              <p className="text-white font-medium">{lastRun.total_removed ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Status</p>
              <p className="text-white font-medium">{lastRun.status ?? '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
