import { useRef, useState } from 'react'
import { api } from '../lib/api'
import type { IgnoreEntry, MonitoringItem, StuckItem } from '../types'
import { usePolling } from '../hooks/usePolling'
import { AlertTriangle, Eye, RefreshCw, Trash2, X } from 'lucide-react'

const ERROR_LABELS: Record<string, { label: string; color: string }> = {
  infringing_file: { label: 'Infringing file', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  task_canceled:   { label: 'Task canceled',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  slow_download:   { label: 'Slow',            color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  arr_only:        { label: 'ARR-only',         color: 'text-slate-400 bg-white/5 border-white/10' },
  other:           { label: 'Other',            color: 'text-slate-400 bg-white/5 border-white/10' },
}

const INSTANCES = ['Sonarr', 'Sonarr-4K', 'Radarr', 'Radarr-4K']

const IGNORE_OPTIONS = [
  { label: '1 hour',    hours: 1 },
  { label: '24 hours',  hours: 24 },
  { label: '7 days',    hours: 24 * 7 },
  { label: '30 days',   hours: 24 * 30 },
  { label: 'Permanent', hours: null },
]

function formatSpeed(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes === 0) return '0 KB/s'
  const kb = bytes / 1024
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB/s`
  return `${Math.round(kb)} KB/s`
}

function StrikeBar({ count, threshold }: { count: number; threshold: number }) {
  const pct = threshold > 0 ? Math.min(count / threshold, 1) : 0
  const color = pct >= 1 ? 'bg-red-500' : pct > 0 ? 'bg-amber-400' : 'bg-slate-600'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className={`text-xs font-medium ${pct >= 1 ? 'text-red-400' : pct > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
        {count}/{threshold}
      </span>
    </div>
  )
}

function IgnoreDropdown({ hash, instanceName, title, onIgnored }: {
  hash: string; instanceName: string; title: string; onIgnored: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const ignore = async (hours: number | null) => {
    setLoading(true)
    setOpen(false)
    const expires_at = hours !== null
      ? new Date(Date.now() + hours * 3600 * 1000).toISOString()
      : null
    await api.ignores.create({ download_hash: hash, instance_name: instanceName, title, expires_at })
      .catch(() => {})
    setLoading(false)
    onIgnored()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="px-2 py-1 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
        title="Ignore this item"
      >
        {loading ? '…' : 'Ignore'}
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-36 bg-[var(--bg-card)] border border-[var(--bd)] rounded-lg shadow-xl overflow-hidden">
          {IGNORE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => ignore(opt.hours)}
              className="w-full px-3 py-2 text-xs text-left text-slate-300 hover:bg-white/10 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Queue() {
  const [stuck, setStuck] = useState<StuckItem[]>([])
  const [monitoring, setMonitoring] = useState<MonitoringItem[]>([])
  const [ignores, setIgnores] = useState<IgnoreEntry[]>([])
  const [filter, setFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      const [s, m, ig] = await Promise.all([
        api.queue.getStuck(filter || undefined),
        api.queue.getMonitoring(filter || undefined),
        api.ignores.list(),
      ])
      setStuck(s)
      setMonitoring(m)
      setIgnores(ig)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  usePolling(load, 30_000)

  const triggerRun = async (dry: boolean) => {
    setRunning(true)
    await (dry ? api.actions.dryRun() : api.actions.execute()).catch(() => {})
    setTimeout(() => { load(); setRunning(false) }, 2000)
  }

  const removeIgnore = async (id: number) => {
    await api.ignores.remove(id)
    load()
  }

  const filteredStuck      = filter ? stuck.filter((i) => i.instance_name === filter) : stuck
  const filteredMonitoring = filter ? monitoring.filter((i) => i.instance_name === filter) : monitoring
  const isEmpty = filteredStuck.length === 0 && filteredMonitoring.length === 0 && ignores.length === 0

  const errorCount = filteredStuck.filter((i) => i.error_type !== 'slow_download').length
  const slowCount  = filteredStuck.filter((i) => i.error_type === 'slow_download').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Queue</h1>
          <p className="text-sm text-slate-400 mt-0.5">Live overview of stuck and slow downloads</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--bd)] rounded-lg text-slate-300"
          >
            <option value="">All instances</option>
            {INSTANCES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <button onClick={() => triggerRun(true)} disabled={running}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50">
            Dry run
          </button>
          <button onClick={() => triggerRun(false)} disabled={running}
            className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
            {running ? 'Running...' : 'Run now'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw size={14} className="animate-spin" /> Loading...
        </div>
      ) : isEmpty ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] p-12 text-center">
          <p className="text-slate-400 text-sm">No stuck or slow downloads found</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Confirmed stuck ── */}
          {filteredStuck.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--bd)] flex items-center gap-3">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-sm font-medium text-slate-200">Confirmed stuck</span>
                <span className="text-xs text-slate-500">
                  {errorCount > 0 && <span>{errorCount} stuck</span>}
                  {errorCount > 0 && slowCount > 0 && <span> · </span>}
                  {slowCount > 0 && <span className="text-yellow-400">{slowCount} slow</span>}
                </span>
                <span className="ml-auto text-xs text-slate-500">RDT error confirmed — will be acted on</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--bd)]">
                    {['Title', 'Instance', 'Status', 'Strikes', 'Speed', 'Added', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStuck.map((item, i) => {
                    const err = ERROR_LABELS[item.error_type] ?? ERROR_LABELS.other
                    const isSlow = item.error_type === 'slow_download'
                    return (
                      <tr key={i} className="border-b border-[var(--bd)]/50 hover:bg-white/2">
                        <td className="px-4 py-3 text-slate-200 max-w-xs truncate" title={item.title}>{item.title}</td>
                        <td className="px-4 py-3 text-slate-400">{item.instance_name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${err.color}`}>
                            {isSlow ? `Slow · ${formatSpeed(item.speed_bytes)}` : err.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StrikeBar count={item.strike_count} threshold={item.strike_threshold} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {isSlow ? <span className="text-yellow-400">{formatSpeed(item.speed_bytes)}</span> : <span>—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {item.added_at ? new Date(item.added_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {item.download_hash && (
                            <IgnoreDropdown
                              hash={item.download_hash}
                              instanceName={item.instance_name}
                              title={item.title}
                              onIgnored={load}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Monitoring ── */}
          {filteredMonitoring.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--bd)] flex items-center gap-3">
                <Eye size={14} className="text-amber-400" />
                <span className="text-sm font-medium text-slate-200">Monitoring</span>
                <span className="text-xs text-slate-500">{filteredMonitoring.length} item{filteredMonitoring.length !== 1 ? 's' : ''}</span>
                <span className="ml-auto text-xs text-slate-500">ARR warning — awaiting RDT error confirmation</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--bd)]">
                    {['Title', 'Instance', 'ARR error', 'Strikes', 'Added', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMonitoring.map((item, i) => (
                    <tr key={i} className="border-b border-[var(--bd)]/50 hover:bg-white/2">
                      <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={item.title}>{item.title}</td>
                      <td className="px-4 py-3 text-slate-400">{item.instance_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-amber-400/80">{item.arr_error_message ?? 'Warning'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StrikeBar count={item.strike_count} threshold={item.strike_threshold} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {item.added_at ? new Date(item.added_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.download_hash && (
                          <IgnoreDropdown
                            hash={item.download_hash}
                            instanceName={item.instance_name}
                            title={item.title}
                            onIgnored={load}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Ignored downloads ── */}
          {ignores.length > 0 && (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--bd)] flex items-center gap-3">
                <X size={14} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-400">Ignored</span>
                <span className="text-xs text-slate-500">{ignores.length} item{ignores.length !== 1 ? 's' : ''} — excluded from detection</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--bd)]">
                    {['Title', 'Instance', 'Expires', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs text-slate-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ignores.map((item) => (
                    <tr key={item.id} className="border-b border-[var(--bd)]/50 hover:bg-white/2">
                      <td className="px-4 py-3 text-slate-400 max-w-xs truncate" title={item.title}>{item.title}</td>
                      <td className="px-4 py-3 text-slate-500">{item.instance_name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {item.expires_at
                          ? new Date(item.expires_at).toLocaleString()
                          : <span className="text-slate-600">Permanent</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeIgnore(item.id)}
                          className="p-1 rounded hover:bg-white/10 text-slate-600 hover:text-red-400 transition-colors"
                          title="Remove ignore"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
