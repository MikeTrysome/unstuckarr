import { useState } from 'react'
import { api } from '../lib/api'
import type { EventListResponse } from '../types'
import { usePolling } from '../hooks/usePolling'

const ACTION_COLORS: Record<string, string> = {
  removed: 'text-green-400 bg-green-500/10 border-green-500/20',
  dry_run: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  skipped: 'text-slate-400 bg-white/5 border-white/10',
  error: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const INSTANCES = ['Sonarr', 'Sonarr-4K', 'Radarr', 'Radarr-4K']
const ACTIONS = ['removed', 'dry_run', 'skipped', 'error']

export default function Events() {
  const [data, setData] = useState<EventListResponse | null>(null)
  const [page, setPage] = useState(1)
  const [filterInstance, setFilterInstance] = useState('')
  const [filterAction, setFilterAction] = useState('')

  const load = async () => {
    const res = await api.events.list({
      instance: filterInstance || undefined,
      action: filterAction || undefined,
      page,
      page_size: 50,
    }).catch(() => null)
    if (res) setData(res)
  }

  usePolling(load, 30_000)

  const totalPages = data ? Math.ceil(data.total / 50) : 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Events</h1>
          <p className="text-sm text-slate-400 mt-0.5">History of cleanup actions</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filterInstance}
            onChange={(e) => { setFilterInstance(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-sm bg-[#1a1d27] border border-[#2a2d3a] rounded-lg text-slate-300"
          >
            <option value="">All instances</option>
            {INSTANCES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-sm bg-[#1a1d27] border border-[#2a2d3a] rounded-lg text-slate-300"
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[#1a1d27] rounded-xl border border-[#2a2d3a] overflow-hidden">
        {!data || data.items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No events found</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3a]">
                  {['Time', 'Title', 'Instance', 'Error type', 'Action', 'Run'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((ev) => {
                  const ac = ACTION_COLORS[ev.action] ?? ACTION_COLORS.skipped
                  return (
                    <tr key={ev.id} className="border-b border-[#2a2d3a]/50 hover:bg-white/2">
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-slate-200 max-w-xs truncate" title={ev.title}>
                        {ev.title}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{ev.instance_name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{ev.error_type ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${ac}`}>
                          {ev.action}{ev.dry_run ? ' (dry)' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                        {ev.run_id?.slice(0, 8) ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="px-4 py-3 border-t border-[#2a2d3a] flex items-center justify-between">
              <span className="text-xs text-slate-500">{data.total} events total</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30"
                >
                  ← Previous
                </button>
                <span className="px-2 py-1 text-xs text-slate-400">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-2 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
