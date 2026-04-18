import { useEffect, useRef, useState } from 'react'
import { CheckCircle, HelpCircle, Pencil, X, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import type { ConnectionConfig, ConnectionConfigUpdate, DbConfig, FullConfig } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'connections' | 'detection' | 'notifications'
type InstanceKey = 'sonarr' | 'sonarr4k' | 'radarr' | 'radarr4k' | 'rdt'

interface ArrDraft {
  host: string
  port: number
  api_key: string   // empty = don't overwrite stored key
  enabled: boolean
}

interface RdtDraft {
  host: string
  port: number
  username: string
  password: string  // empty = don't overwrite stored password
  enabled: boolean
}

interface ConnDrafts {
  sonarr:   ArrDraft
  sonarr4k: ArrDraft
  radarr:   ArrDraft
  radarr4k: ArrDraft
  rdt:      RdtDraft
}

interface InstanceMeta {
  key: InstanceKey
  label: string
  testKey: string
}

const INSTANCES: InstanceMeta[] = [
  { key: 'sonarr',   label: 'Sonarr',     testKey: 'Sonarr'     },
  { key: 'sonarr4k', label: 'Sonarr-4K',  testKey: 'Sonarr-4K'  },
  { key: 'radarr',   label: 'Radarr',     testKey: 'Radarr'     },
  { key: 'radarr4k', label: 'Radarr-4K',  testKey: 'Radarr-4K'  },
  { key: 'rdt',      label: 'RDT-client', testKey: 'RDT-client' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildConnDrafts(conn: ConnectionConfig): ConnDrafts {
  return {
    sonarr:   { host: conn.sonarr_host,   port: conn.sonarr_port,   api_key: '', enabled: conn.sonarr_enabled   },
    sonarr4k: { host: conn.sonarr4k_host, port: conn.sonarr4k_port, api_key: '', enabled: conn.sonarr4k_enabled },
    radarr:   { host: conn.radarr_host,   port: conn.radarr_port,   api_key: '', enabled: conn.radarr_enabled   },
    radarr4k: { host: conn.radarr4k_host, port: conn.radarr4k_port, api_key: '', enabled: conn.radarr4k_enabled },
    rdt:      { host: conn.rdt_host, port: conn.rdt_port, username: conn.rdt_username, password: '', enabled: conn.rdt_enabled },
  }
}

function buildConnectionUpdate(drafts: ConnDrafts): ConnectionConfigUpdate {
  const upd: ConnectionConfigUpdate = {}
  const arr = (key: 'sonarr' | 'sonarr4k' | 'radarr' | 'radarr4k', d: ArrDraft) => {
    upd[`${key}_host`    as keyof ConnectionConfigUpdate] = d.host    as never
    upd[`${key}_port`    as keyof ConnectionConfigUpdate] = d.port    as never
    upd[`${key}_enabled` as keyof ConnectionConfigUpdate] = d.enabled as never
    if (d.api_key) upd[`${key}_api_key` as keyof ConnectionConfigUpdate] = d.api_key as never
  }
  arr('sonarr',   drafts.sonarr)
  arr('sonarr4k', drafts.sonarr4k)
  arr('radarr',   drafts.radarr)
  arr('radarr4k', drafts.radarr4k)
  upd.rdt_host     = drafts.rdt.host
  upd.rdt_port     = drafts.rdt.port
  upd.rdt_username = drafts.rdt.username
  upd.rdt_enabled  = drafts.rdt.enabled
  if (drafts.rdt.password) upd.rdt_password = drafts.rdt.password
  return upd
}

function isConfigured(draft: ArrDraft | RdtDraft): boolean {
  return Boolean(draft.host)
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-600 hover:text-slate-400 transition-colors"
        tabIndex={-1}
      >
        <HelpCircle size={14} />
      </button>
      {show && (
        <div className="absolute left-5 top-0 z-50 w-56 px-3 py-2 text-xs text-slate-300 bg-[#0f1117] border border-[#2a2d3a] rounded-lg shadow-xl pointer-events-none">
          {text}
        </div>
      )}
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-[#1a1d27] rounded-xl border border-[#2a2d3a] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2d3a]">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Modal field row ──────────────────────────────────────────────────────────

function MField({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2a2d3a] last:border-0 gap-4">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm text-slate-400">{label}</span>
        {tooltip && <Tip text={tooltip} />}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

const INPUT_CLS = 'w-48 px-2 py-1 text-sm bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-600'
const PORT_CLS  = 'w-24 px-2 py-1 text-sm text-center bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono'

// ─── ARR Edit Modal ───────────────────────────────────────────────────────────

function ArrModal({
  label, keySet, draft, onSave, onClose, testKey,
}: {
  label: string
  keySet: boolean
  draft: ArrDraft
  onSave: (d: ArrDraft) => void
  onClose: () => void
  testKey: string
}) {
  const [local, setLocal] = useState<ArrDraft>({ ...draft })
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const test = async () => {
    setTestState('testing')
    const res = await api.config.testOne(testKey).catch(() => null)
    setTestState(res?.ok ? 'ok' : 'fail')
  }

  return (
    <Modal title={`Edit ${label}`} onClose={onClose}>
      <MField label="Enabled">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={local.enabled}
            onChange={(e) => setLocal({ ...local, enabled: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-400">Enable this instance</span>
        </label>
      </MField>
      <MField label="Host" tooltip="IP address or hostname of your ARR instance (e.g. 192.168.1.100)">
        <input
          type="text"
          value={local.host}
          onChange={(e) => setLocal({ ...local, host: e.target.value })}
          placeholder="192.168.1.x"
          className={INPUT_CLS}
        />
      </MField>
      <MField label="Port" tooltip="Default: Sonarr 8989, Radarr 7878">
        <input
          type="number"
          value={local.port}
          onChange={(e) => setLocal({ ...local, port: Number(e.target.value) })}
          min={1} max={65535}
          className={PORT_CLS}
        />
      </MField>
      <MField label="API Key" tooltip="Found in Settings → General → Security in your ARR instance">
        <input
          type="password"
          value={local.api_key}
          onChange={(e) => setLocal({ ...local, api_key: e.target.value })}
          placeholder={keySet ? 'Leave blank to keep current' : 'Paste API key'}
          className={INPUT_CLS}
        />
        {keySet && !local.api_key && <span className="text-xs text-slate-500 shrink-0">key set</span>}
      </MField>

      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={test}
          disabled={testState === 'testing'}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50"
        >
          {testState === 'testing' ? 'Testing…' : 'Test connection'}
          {testState === 'ok'   && <CheckCircle size={14} className="text-green-400" />}
          {testState === 'fail' && <XCircle size={14} className="text-red-400" />}
        </button>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(local); onClose() }}
            className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── RDT Edit Modal ───────────────────────────────────────────────────────────

function RdtModal({
  passwordSet, draft, onSave, onClose,
}: {
  passwordSet: boolean
  draft: RdtDraft
  onSave: (d: RdtDraft) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<RdtDraft>({ ...draft })
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const test = async () => {
    setTestState('testing')
    const res = await api.config.testOne('rdt').catch(() => null)
    setTestState(res?.ok ? 'ok' : 'fail')
  }

  return (
    <Modal title="Edit RDT-client" onClose={onClose}>
      <MField label="Enabled">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={local.enabled}
            onChange={(e) => setLocal({ ...local, enabled: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
          <span className="text-xs text-slate-400">Enable RDT-client</span>
        </label>
      </MField>
      <MField label="Host" tooltip="IP address or hostname of your RDT-client instance">
        <input
          type="text"
          value={local.host}
          onChange={(e) => setLocal({ ...local, host: e.target.value })}
          placeholder="192.168.1.x"
          className={INPUT_CLS}
        />
      </MField>
      <MField label="Port" tooltip="Default RDT-client port is 6500">
        <input
          type="number"
          value={local.port}
          onChange={(e) => setLocal({ ...local, port: Number(e.target.value) })}
          min={1} max={65535}
          className={PORT_CLS}
        />
      </MField>
      <MField label="Username" tooltip="Your RDT-client login username">
        <input
          type="text"
          value={local.username}
          onChange={(e) => setLocal({ ...local, username: e.target.value })}
          placeholder="username"
          className={INPUT_CLS}
        />
      </MField>
      <MField label="Password" tooltip="Your RDT-client login password">
        <input
          type="password"
          value={local.password}
          onChange={(e) => setLocal({ ...local, password: e.target.value })}
          placeholder={passwordSet ? 'Leave blank to keep current' : 'Enter password'}
          className={INPUT_CLS}
        />
        {passwordSet && !local.password && <span className="text-xs text-slate-500 shrink-0">set</span>}
      </MField>

      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={test}
          disabled={testState === 'testing'}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50"
        >
          {testState === 'testing' ? 'Testing…' : 'Test connection'}
          {testState === 'ok'   && <CheckCircle size={14} className="text-green-400" />}
          {testState === 'fail' && <XCircle size={14} className="text-red-400" />}
        </button>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(local); onClose() }}
            className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Instance Card ────────────────────────────────────────────────────────────

function InstanceCard({
  label, draft, onEdit, isRdt = false,
}: {
  label: string
  draft: ArrDraft | RdtDraft
  onEdit: () => void
  isRdt?: boolean
}) {
  const configured = isConfigured(draft)
  return (
    <div className="bg-[#0f1117] rounded-xl border border-[#2a2d3a] p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          !configured ? 'bg-slate-600' :
          draft.enabled ? 'bg-green-500' : 'bg-amber-500'
        }`} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-200">{label}</p>
          <p className="text-xs text-slate-500 font-mono truncate">
            {configured
              ? `${draft.host}:${draft.port}`
              : isRdt ? 'Not configured' : 'Not configured'
            }
          </p>
          {!draft.enabled && configured && (
            <p className="text-xs text-amber-500/80">Disabled</p>
          )}
        </div>
      </div>
      <button
        onClick={onEdit}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
      >
        <Pencil size={12} />
        Edit
      </button>
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
        active
          ? 'border-indigo-500 text-white'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Settings() {
  const [config, setConfig]         = useState<FullConfig | null>(null)
  const [connDrafts, setConnDrafts] = useState<ConnDrafts | null>(null)
  const [dbDraft, setDbDraft]       = useState<Partial<DbConfig>>({})
  const [activeTab, setActiveTab]   = useState<Tab>('connections')
  const [editing, setEditing]       = useState<InstanceKey | null>(null)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  useEffect(() => {
    api.config.get().then((c) => {
      setConfig(c)
      setConnDrafts(buildConnDrafts(c.connections))
      setDbDraft({ ...c.db })
    }).catch(() => {})
  }, [])

  const saveAll = async (drafts: ConnDrafts, db: Partial<DbConfig>) => {
    setSaving(true)
    const updated = await api.config.update({
      connections: buildConnectionUpdate(drafts),
      db,
    }).catch(() => null)
    if (updated) {
      setConfig(updated)
      setConnDrafts(buildConnDrafts(updated.connections))
      setDbDraft({ ...updated.db })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleArrSave = (key: 'sonarr' | 'sonarr4k' | 'radarr' | 'radarr4k', draft: ArrDraft) => {
    if (!connDrafts) return
    const updated = { ...connDrafts, [key]: draft }
    setConnDrafts(updated)
    saveAll(updated, dbDraft)
  }

  const handleRdtSave = (draft: RdtDraft) => {
    if (!connDrafts) return
    const updated = { ...connDrafts, rdt: draft }
    setConnDrafts(updated)
    saveAll(updated, dbDraft)
  }

  if (!config || !connDrafts) return <p className="text-slate-500 text-sm">Loading…</p>

  const { connections, db } = config

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Configure connections and detection settings. API keys are stored securely in the local database.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2d3a] -mb-1">
        <TabBtn active={activeTab === 'connections'}  onClick={() => setActiveTab('connections')}>Connections</TabBtn>
        <TabBtn active={activeTab === 'detection'}    onClick={() => setActiveTab('detection')}>Detection</TabBtn>
        <TabBtn active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')}>Notifications</TabBtn>
      </div>

      {/* ── Connections tab ── */}
      {activeTab === 'connections' && (
        <div className="space-y-3">
          {INSTANCES.map(({ key, label }) => (
            <InstanceCard
              key={key}
              label={label}
              draft={connDrafts[key]}
              onEdit={() => setEditing(key)}
              isRdt={key === 'rdt'}
            />
          ))}
        </div>
      )}

      {/* ── Detection tab ── */}
      {activeTab === 'detection' && (
        <div className="space-y-4">
          {/* Scheduler */}
          <div className="bg-[#1a1d27] rounded-xl border border-[#2a2d3a] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2a2d3a]">
              <h2 className="text-sm font-medium text-white">Scheduler</h2>
            </div>
            <div className="px-5">
              {[
                { key: 'scheduler_enabled' as keyof DbConfig, label: 'Scheduler enabled',
                  tooltip: 'Run cleanup automatically on the configured interval' },
                { key: 'scheduler_dry_run' as keyof DbConfig, label: 'Dry run mode',
                  tooltip: 'Log stuck items but do not actually remove them from ARR' },
              ].map(({ key, label, tooltip }) => (
                <div key={key} className="flex items-center justify-between py-2.5 border-b border-[#2a2d3a] last:border-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-400">{label}</span>
                    <Tip text={tooltip} />
                  </div>
                  <input
                    type="checkbox"
                    checked={(dbDraft[key] as boolean) ?? (db[key] as boolean)}
                    onChange={(e) => setDbDraft((d) => ({ ...d, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Thresholds */}
          <div className="bg-[#1a1d27] rounded-xl border border-[#2a2d3a] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2a2d3a]">
              <h2 className="text-sm font-medium text-white">Detection thresholds</h2>
            </div>
            <div className="px-5">
              {[
                { key: 'detection_infringing_min_age_minutes' as keyof DbConfig,
                  label: 'Infringing file — min. age (min)',
                  tooltip: 'A download must be at least this old before it is treated as permanently stuck due to an infringing file error' },
                { key: 'detection_canceled_min_age_minutes' as keyof DbConfig,
                  label: 'Task canceled — min. age (min)',
                  tooltip: 'A download must be at least this old before a task-canceled error is treated as stuck (transient errors resolve themselves faster)' },
                { key: 'detection_min_retry_count' as keyof DbConfig,
                  label: 'Min. retry count (RDT)',
                  tooltip: 'RDT-client must have retried the download at least this many times before Unstuckarr intervenes' },
              ].map(({ key, label, tooltip }) => (
                <div key={key} className="flex items-center justify-between py-2.5 border-b border-[#2a2d3a] last:border-0 gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-400">{label}</span>
                    <Tip text={tooltip} />
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={(dbDraft[key] as number) ?? (db[key] as number)}
                    onChange={(e) => setDbDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                    className="w-20 px-2 py-1 text-sm text-center bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => saveAll(connDrafts, dbDraft)}
              disabled={saving}
              className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium disabled:opacity-50"
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Notifications tab ── */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] rounded-xl border border-[#2a2d3a] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#2a2d3a]">
              <h2 className="text-sm font-medium text-white">Apprise URLs</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-slate-400">
                Unstuckarr uses <span className="text-slate-300 font-medium">Apprise</span> for notifications — one URL per line.
                Supports 80+ services including Discord, Telegram, Slack, Ntfy, Pushover and more.
              </p>
              <textarea
                value={(dbDraft.notifications_apprise_urls ?? db.notifications_apprise_urls).join('\n')}
                onChange={(e) =>
                  setDbDraft((d) => ({
                    ...d,
                    notifications_apprise_urls: e.target.value.split('\n').filter(Boolean),
                  }))
                }
                placeholder={
                  'discord://webhook_id/token\nntfy://topic\ntelegram://token/chat_id'
                }
                rows={5}
                className="w-full px-3 py-2 text-sm font-mono bg-[#0f1117] border border-[#2a2d3a] rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600"
              />
              <p className="text-xs text-slate-500">
                Full list of supported services:{' '}
                <a
                  href="https://github.com/caronc/apprise/wiki"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  apprise wiki
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => saveAll(connDrafts, dbDraft)}
              disabled={saving}
              className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium disabled:opacity-50"
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Edit modals ── */}
      {editing && editing !== 'rdt' && (
        <ArrModal
          label={INSTANCES.find((i) => i.key === editing)!.label}
          testKey={INSTANCES.find((i) => i.key === editing)!.testKey}
          keySet={(connections as never)[`${editing}_api_key_set`] as boolean}
          draft={connDrafts[editing] as ArrDraft}
          onSave={(d) => handleArrSave(editing as 'sonarr' | 'sonarr4k' | 'radarr' | 'radarr4k', d)}
          onClose={() => setEditing(null)}
        />
      )}
      {editing === 'rdt' && (
        <RdtModal
          passwordSet={connections.rdt_password_set}
          draft={connDrafts.rdt}
          onSave={handleRdtSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
