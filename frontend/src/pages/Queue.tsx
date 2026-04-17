import { useState } from 'react'
import { api } from '../lib/api'
import type { StuckItem } from '../types'
import { usePolling } from '../hooks/usePolling'
import { AlertTriangle, RefreshCw } from 'lucide-react'

const ERROR_LABELS: Record<string, { label: string; color: string }> = {
  infringing_file: { label: 'Infringing file', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  task_canceled: { label: 'Task canceled', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  arr_only: { label: 'ARR-only', color: 'text-slate-400 bg-white/5 border-white/10' },
  other: { label: 'Overig', color: 'text-slate-400 bg-white/5 border-white/10' },
}

const INSTANCES = ['Sonarr', 'Sonarr-4K', 'Radarr', 'Radarr-4K']

export default function Queue() {
  const [items, setItems] = useState<StuckItem[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setItems(await api.queue.getStuck(filter || undefined))
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Fout')
    } finally {
      setLoading(false)
    }
  }

  usePolling(load, 30_000)

  const triggerRun = async (dry: boolean) => {
    setRunning(true)
    await (dry ? api.actions.dryRun() : api.actions.execute()).catch(() => {})
    setTimeout(() => setRunning(false), 2000)
  }

  const filtered = filter ? items.filter((i) => i.instance_name === filter) : items

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Queue</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Live overzicht van vastgelopen downloads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-[#1a1d27] border border-[#2a2d3a] rounded-lg text-slate-300"
          >
            <option value="">Alle instanties</option>
            {INSTANCES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <button
            onClick={() => triggerRun(true)}
            disabled={running}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50"
          >
            Dry-run
          </button>
          <button
            onClick={() => triggerRun(false)}
            disabled={running}
            className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            {running ? 'Bezig...' : 'Nu uitvoeren'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw size={14} className="animate-spin" />
          Laden...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#1a1d27] rounded-xl border border-[#2a2d3a] p-12 text-center">
          <p className="text-slate-400 text-sm">Geen vastgelopen downloads gevonden</p>
        </div>
      ) : (
        <div className="bg-[#1a1d27] rounded-xl border border-[#2a2d3a] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#2a2d3a] flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-sm text-slate-300">{filtered.length} vastgelopen item(s)</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a2d3a]">
                {['Titel', 'Instantie', 'Fouttype', 'Hash', 'Retries', 'Toegevoegd'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const err = ERROR_LABELS[item.error_type] ?? ERROR_LABELS.other
                return (
                  <tr key={i} className="border-b border-[#2a2d3a]/50 hover:bg-white/2">
                    <td className="px-4 py-3 text-slate-200 max-w-xs truncate" title={item.title}>
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{item.instance_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${err.color}`}>
                        {err.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {item.download_hash?.slice(0, 12) ?? '—'}...
                    </td>
                    <td className="px-4 py-3 text-slate-400">{item.retry_count}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {item.added_at ? new Date(item.added_at).toLocaleString('nl') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
