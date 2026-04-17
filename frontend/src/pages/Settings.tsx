import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { DbConfig, FullConfig } from '../types'
import { Check, X } from 'lucide-react'

function Row({ label, value, ok }: { label: string; value: string | boolean; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2a2d3a] last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        {ok !== undefined && (
          ok ? <Check size={14} className="text-green-400" /> : <X size={14} className="text-red-400" />
        )}
        <span className="text-sm text-slate-200 font-mono">{String(value)}</span>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1d27] rounded-xl border border-[#2a2d3a] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2d3a]">
        <h2 className="text-sm font-medium text-white">{title}</h2>
      </div>
      <div className="px-5">{children}</div>
    </div>
  )
}

export default function Settings() {
  const [config, setConfig] = useState<FullConfig | null>(null)
  const [draft, setDraft] = useState<Partial<DbConfig>>({})
  const [saved, setSaved] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, boolean> | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    api.config.get().then((c) => {
      setConfig(c)
      setDraft({ ...c.db })
    }).catch(() => {})
  }, [])

  const save = async () => {
    await api.config.update(draft).catch(() => {})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testConnections = async () => {
    setTesting(true)
    const res = await api.config.testAll().catch(() => null)
    setTestResults(res)
    setTesting(false)
  }

  if (!config) return <p className="text-slate-500 text-sm">Loading...</p>

  const { env, db } = config

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Secrets are managed via environment variables.
            Thresholds and scheduler settings are configurable here.
          </p>
        </div>
      </div>

      {/* Connection status */}
      <Section title="Connections (env vars)">
        <div className="py-1">
          {[
            { label: 'Sonarr', host: env.sonarr_host, port: env.sonarr_port, key: env.sonarr_api_key_set },
            { label: 'Sonarr-4K', host: env.sonarr4k_host, port: env.sonarr4k_port, key: env.sonarr4k_api_key_set },
            { label: 'Radarr', host: env.radarr_host, port: env.radarr_port, key: env.radarr_api_key_set },
            { label: 'Radarr-4K', host: env.radarr4k_host, port: env.radarr4k_port, key: env.radarr4k_api_key_set },
          ].map(({ label, host, port, key }) => (
            <Row
              key={label}
              label={label}
              value={`${host}:${port}`}
              ok={key && testResults ? testResults[label] : key ? undefined : false}
            />
          ))}
          <Row
            label="RDT-client"
            value={`${env.rdt_host}:${env.rdt_port}`}
            ok={env.rdt_username_set && env.rdt_password_set && testResults ? testResults['RDT-client'] : undefined}
          />
          <div className="py-3">
            <button
              onClick={testConnections}
              disabled={testing}
              className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test connections'}
            </button>
          </div>
        </div>
      </Section>

      {/* Scheduler */}
      <Section title="Scheduler">
        <div className="py-1">
          <Row label="Interval (minutes)" value={`${env.interval_minutes} (env var)`} />
          <div className="flex items-center justify-between py-2.5 border-b border-[#2a2d3a]">
            <span className="text-sm text-slate-400">Scheduler enabled</span>
            <input
              type="checkbox"
              checked={draft.scheduler_enabled ?? db.scheduler_enabled}
              onChange={(e) => setDraft((d) => ({ ...d, scheduler_enabled: e.target.checked }))}
              className="w-4 h-4 accent-indigo-500"
            />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-400">Dry run mode</span>
            <input
              type="checkbox"
              checked={draft.scheduler_dry_run ?? db.scheduler_dry_run}
              onChange={(e) => setDraft((d) => ({ ...d, scheduler_dry_run: e.target.checked }))}
              className="w-4 h-4 accent-indigo-500"
            />
          </div>
        </div>
      </Section>

      {/* Detection thresholds */}
      <Section title="Detection thresholds">
        <div className="py-1 space-y-0">
          {[
            { key: 'detection_infringing_min_age_minutes' as keyof DbConfig, label: 'Infringing file — min. age (min)', default: db.detection_infringing_min_age_minutes },
            { key: 'detection_canceled_min_age_minutes' as keyof DbConfig, label: 'Task canceled — min. age (min)', default: db.detection_canceled_min_age_minutes },
            { key: 'detection_min_retry_count' as keyof DbConfig, label: 'Min. retry count (RDT)', default: db.detection_min_retry_count },
          ].map(({ key, label, default: def }) => (
            <div key={key} className="flex items-center justify-between py-2.5 border-b border-[#2a2d3a] last:border-0">
              <span className="text-sm text-slate-400">{label}</span>
              <input
                type="number"
                min={0}
                value={(draft[key] as number) ?? def}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                className="w-20 px-2 py-1 text-sm text-center bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications (Apprise URLs)">
        <div className="py-3">
          <textarea
            value={(draft.notifications_apprise_urls ?? db.notifications_apprise_urls).join('\n')}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                notifications_apprise_urls: e.target.value.split('\n').filter(Boolean),
              }))
            }
            placeholder="discord://webhook_id/token&#10;ntfy://topic&#10;telegram://token/chat_id"
            rows={4}
            className="w-full px-3 py-2 text-sm font-mono bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
          />
          <p className="text-xs text-slate-500 mt-1">One URL per line. Supports all Apprise services (Discord, Telegram, Ntfy, etc.)</p>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
