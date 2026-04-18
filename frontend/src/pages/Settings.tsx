import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ConnectionConfig, ConnectionConfigUpdate, DbConfig, FullConfig } from '../types'

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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2a2d3a] last:border-0 gap-4">
      <span className="text-sm text-slate-400 shrink-0">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

interface ArrDraft {
  host: string
  port: number
  api_key: string   // empty = "don't send"
  enabled: boolean
}

interface RdtDraft {
  host: string
  port: number
  username: string
  password: string  // empty = "don't send"
  enabled: boolean
}

function buildArrDraft(conn: ConnectionConfig, prefix: 'sonarr' | 'sonarr4k' | 'radarr' | 'radarr4k'): ArrDraft {
  return {
    host:    (conn as never)[`${prefix}_host`] as string,
    port:    (conn as never)[`${prefix}_port`] as number,
    api_key: '',   // never pre-fill secrets
    enabled: (conn as never)[`${prefix}_enabled`] as boolean,
  }
}

interface ConnDrafts {
  sonarr:   ArrDraft
  sonarr4k: ArrDraft
  radarr:   ArrDraft
  radarr4k: ArrDraft
  rdt: RdtDraft
}

function buildConnDrafts(conn: ConnectionConfig): ConnDrafts {
  return {
    sonarr:   buildArrDraft(conn, 'sonarr'),
    sonarr4k: buildArrDraft(conn, 'sonarr4k'),
    radarr:   buildArrDraft(conn, 'radarr'),
    radarr4k: buildArrDraft(conn, 'radarr4k'),
    rdt: {
      host:     conn.rdt_host,
      port:     conn.rdt_port,
      username: conn.rdt_username,
      password: '',   // never pre-fill secrets
      enabled:  conn.rdt_enabled,
    },
  }
}

function buildConnectionUpdate(drafts: ConnDrafts): ConnectionConfigUpdate {
  const upd: ConnectionConfigUpdate = {}

  const arr = (
    key: 'sonarr' | 'sonarr4k' | 'radarr' | 'radarr4k',
    d: ArrDraft,
  ) => {
    upd[`${key}_host` as keyof ConnectionConfigUpdate] = d.host as never
    upd[`${key}_port` as keyof ConnectionConfigUpdate] = d.port as never
    upd[`${key}_enabled` as keyof ConnectionConfigUpdate] = d.enabled as never
    if (d.api_key) {
      upd[`${key}_api_key` as keyof ConnectionConfigUpdate] = d.api_key as never
    }
  }

  arr('sonarr',   drafts.sonarr)
  arr('sonarr4k', drafts.sonarr4k)
  arr('radarr',   drafts.radarr)
  arr('radarr4k', drafts.radarr4k)

  upd.rdt_host     = drafts.rdt.host
  upd.rdt_port     = drafts.rdt.port
  upd.rdt_username = drafts.rdt.username
  upd.rdt_enabled  = drafts.rdt.enabled
  if (drafts.rdt.password) {
    upd.rdt_password = drafts.rdt.password
  }

  return upd
}

function ArrInstanceForm({
  label,
  keySet,
  draft,
  onChange,
  testResult,
}: {
  label: string
  keySet: boolean
  draft: ArrDraft
  onChange: (d: ArrDraft) => void
  testResult?: boolean
}) {
  return (
    <div className="py-2 space-y-0 border-b border-[#2a2d3a] last:border-0">
      <div className="flex items-center justify-between py-1.5">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => onChange({ ...draft, enabled: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
          Enabled
        </label>
      </div>
      <FieldRow label="Host">
        <input
          type="text"
          value={draft.host}
          onChange={(e) => onChange({ ...draft, host: e.target.value })}
          placeholder="192.168.1.x"
          className="w-48 px-2 py-1 text-sm bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
        />
      </FieldRow>
      <FieldRow label="Port">
        <input
          type="number"
          value={draft.port}
          onChange={(e) => onChange({ ...draft, port: Number(e.target.value) })}
          min={1}
          max={65535}
          className="w-24 px-2 py-1 text-sm bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-center"
        />
        {testResult !== undefined && (
          <span className={`text-xs ${testResult ? 'text-green-400' : 'text-red-400'}`}>
            {testResult ? 'OK' : 'Failed'}
          </span>
        )}
      </FieldRow>
      <FieldRow label="API Key">
        <input
          type="password"
          value={draft.api_key}
          onChange={(e) => onChange({ ...draft, api_key: e.target.value })}
          placeholder={keySet ? 'Set new key to change' : 'No key set'}
          className="w-48 px-2 py-1 text-sm bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-600"
        />
        {keySet && !draft.api_key && (
          <span className="text-xs text-slate-500">key set</span>
        )}
      </FieldRow>
    </div>
  )
}

export default function Settings() {
  const [config, setConfig] = useState<FullConfig | null>(null)
  const [connDrafts, setConnDrafts] = useState<ConnDrafts | null>(null)
  const [dbDraft, setDbDraft] = useState<Partial<DbConfig>>({})
  const [saved, setSaved] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, boolean> | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    api.config.get().then((c) => {
      setConfig(c)
      setConnDrafts(buildConnDrafts(c.connections))
      setDbDraft({ ...c.db })
    }).catch(() => {})
  }, [])

  const save = async () => {
    if (!connDrafts) return
    const updated = await api.config.update({
      connections: buildConnectionUpdate(connDrafts),
      db: dbDraft,
    }).catch(() => null)
    if (updated) {
      setConfig(updated)
      // Reset connection drafts from new server state (api_key fields cleared)
      setConnDrafts(buildConnDrafts(updated.connections))
      setDbDraft({ ...updated.db })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testConnections = async () => {
    setTesting(true)
    const res = await api.config.testAll().catch(() => null)
    setTestResults(res)
    setTesting(false)
  }

  if (!config || !connDrafts) return <p className="text-slate-500 text-sm">Loading...</p>

  const { connections, db } = config

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Configure connections and detection settings. API keys are stored securely in the local database.
        </p>
      </div>

      {/* ARR Instances */}
      <Section title="ARR Connections">
        <div className="py-1">
          <ArrInstanceForm
            label="Sonarr"
            keySet={connections.sonarr_api_key_set}
            draft={connDrafts.sonarr}
            onChange={(d) => setConnDrafts((prev) => prev ? { ...prev, sonarr: d } : prev)}
            testResult={testResults?.['Sonarr']}
          />
          <ArrInstanceForm
            label="Sonarr-4K"
            keySet={connections.sonarr4k_api_key_set}
            draft={connDrafts.sonarr4k}
            onChange={(d) => setConnDrafts((prev) => prev ? { ...prev, sonarr4k: d } : prev)}
            testResult={testResults?.['Sonarr-4K']}
          />
          <ArrInstanceForm
            label="Radarr"
            keySet={connections.radarr_api_key_set}
            draft={connDrafts.radarr}
            onChange={(d) => setConnDrafts((prev) => prev ? { ...prev, radarr: d } : prev)}
            testResult={testResults?.['Radarr']}
          />
          <ArrInstanceForm
            label="Radarr-4K"
            keySet={connections.radarr4k_api_key_set}
            draft={connDrafts.radarr4k}
            onChange={(d) => setConnDrafts((prev) => prev ? { ...prev, radarr4k: d } : prev)}
            testResult={testResults?.['Radarr-4K']}
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

      {/* RDT-client */}
      <Section title="RDT-client">
        <div className="py-2">
          <div className="flex items-center justify-between py-1.5 border-b border-[#2a2d3a]">
            <span className="text-sm font-medium text-slate-200">RDT-client</span>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={connDrafts.rdt.enabled}
                onChange={(e) => setConnDrafts((prev) => prev ? { ...prev, rdt: { ...prev.rdt, enabled: e.target.checked } } : prev)}
                className="w-4 h-4 accent-indigo-500"
              />
              Enabled
            </label>
          </div>
          <FieldRow label="Host">
            <input
              type="text"
              value={connDrafts.rdt.host}
              onChange={(e) => setConnDrafts((prev) => prev ? { ...prev, rdt: { ...prev.rdt, host: e.target.value } } : prev)}
              placeholder="192.168.1.x"
              className="w-48 px-2 py-1 text-sm bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </FieldRow>
          <FieldRow label="Port">
            <input
              type="number"
              value={connDrafts.rdt.port}
              onChange={(e) => setConnDrafts((prev) => prev ? { ...prev, rdt: { ...prev.rdt, port: Number(e.target.value) } } : prev)}
              min={1}
              max={65535}
              className="w-24 px-2 py-1 text-sm bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-center"
            />
            {testResults?.['RDT-client'] !== undefined && (
              <span className={`text-xs ${testResults['RDT-client'] ? 'text-green-400' : 'text-red-400'}`}>
                {testResults['RDT-client'] ? 'OK' : 'Failed'}
              </span>
            )}
          </FieldRow>
          <FieldRow label="Username">
            <input
              type="text"
              value={connDrafts.rdt.username}
              onChange={(e) => setConnDrafts((prev) => prev ? { ...prev, rdt: { ...prev.rdt, username: e.target.value } } : prev)}
              placeholder="username"
              className="w-48 px-2 py-1 text-sm bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </FieldRow>
          <FieldRow label="Password">
            <input
              type="password"
              value={connDrafts.rdt.password}
              onChange={(e) => setConnDrafts((prev) => prev ? { ...prev, rdt: { ...prev.rdt, password: e.target.value } } : prev)}
              placeholder={connections.rdt_password_set ? 'Set new password to change' : 'No password set'}
              className="w-48 px-2 py-1 text-sm bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-600"
            />
            {connections.rdt_password_set && !connDrafts.rdt.password && (
              <span className="text-xs text-slate-500">set</span>
            )}
          </FieldRow>
        </div>
      </Section>

      {/* Scheduler */}
      <Section title="Scheduler">
        <div className="py-1">
          <div className="flex items-center justify-between py-2.5 border-b border-[#2a2d3a]">
            <span className="text-sm text-slate-400">Scheduler enabled</span>
            <input
              type="checkbox"
              checked={dbDraft.scheduler_enabled ?? db.scheduler_enabled}
              onChange={(e) => setDbDraft((d) => ({ ...d, scheduler_enabled: e.target.checked }))}
              className="w-4 h-4 accent-indigo-500"
            />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-slate-400">Dry run mode</span>
            <input
              type="checkbox"
              checked={dbDraft.scheduler_dry_run ?? db.scheduler_dry_run}
              onChange={(e) => setDbDraft((d) => ({ ...d, scheduler_dry_run: e.target.checked }))}
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
                value={(dbDraft[key] as number) ?? def}
                onChange={(e) => setDbDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
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
            value={(dbDraft.notifications_apprise_urls ?? db.notifications_apprise_urls).join('\n')}
            onChange={(e) =>
              setDbDraft((d) => ({
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
