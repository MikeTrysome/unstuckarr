import { useEffect, useState } from 'react'
import { CheckCircle, Pencil, Trash2, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import type { ConnectionConfig, ConnectionConfigUpdate, FullConfig } from '../../types'
import { INPUT_CLS, MField, Modal, PageHeader, PORT_CLS, SectionCard, ServerError, Toggle } from '../../components/settings/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

type ArrKey = 'sonarr' | 'sonarr4k' | 'radarr' | 'radarr4k'
type EditTarget = ArrKey | 'rdt' | null

interface ArrDraft {
  host: string
  port: number
  api_key: string
  enabled: boolean
}

interface RdtDraft {
  host: string
  port: number
  username: string
  password: string
  enabled: boolean
}

interface Drafts {
  sonarr: ArrDraft
  sonarr4k: ArrDraft
  radarr: ArrDraft
  radarr4k: ArrDraft
  rdt: RdtDraft
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const _MASKED = '***'

function buildDrafts(conn: ConnectionConfig): Drafts {
  return {
    sonarr:   { host: conn.sonarr_host,   port: conn.sonarr_port,   api_key: '', enabled: conn.sonarr_enabled   },
    sonarr4k: { host: conn.sonarr4k_host, port: conn.sonarr4k_port, api_key: '', enabled: conn.sonarr4k_enabled },
    radarr:   { host: conn.radarr_host,   port: conn.radarr_port,   api_key: '', enabled: conn.radarr_enabled   },
    radarr4k: { host: conn.radarr4k_host, port: conn.radarr4k_port, api_key: '', enabled: conn.radarr4k_enabled },
    rdt: { host: conn.rdt_host, port: conn.rdt_port, username: conn.rdt_username, password: '', enabled: conn.rdt_enabled },
  }
}

function buildUpdate(d: Drafts): ConnectionConfigUpdate {
  const upd: ConnectionConfigUpdate = {}
  const arr = (k: ArrKey, v: ArrDraft) => {
    upd[`${k}_host` as keyof ConnectionConfigUpdate]    = v.host    as never
    upd[`${k}_port` as keyof ConnectionConfigUpdate]    = v.port    as never
    upd[`${k}_enabled` as keyof ConnectionConfigUpdate] = v.enabled as never
    if (v.api_key && v.api_key !== _MASKED)
      upd[`${k}_api_key` as keyof ConnectionConfigUpdate] = v.api_key as never
  }
  arr('sonarr', d.sonarr); arr('sonarr4k', d.sonarr4k)
  arr('radarr', d.radarr); arr('radarr4k', d.radarr4k)
  upd.rdt_host = d.rdt.host; upd.rdt_port = d.rdt.port
  upd.rdt_username = d.rdt.username; upd.rdt_enabled = d.rdt.enabled
  if (d.rdt.password && d.rdt.password !== _MASKED) upd.rdt_password = d.rdt.password
  return upd
}

// ─── Instance row (inside group card) ────────────────────────────────────────

function InstanceRow({
  label, draft, onEdit, onClear, configured,
}: {
  label: string
  draft: ArrDraft | RdtDraft
  onEdit: () => void
  onClear: () => void
  configured: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--bd)] last:border-0 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2 h-2 rounded-full shrink-0 ${
          !configured ? 'bg-slate-600' : draft.enabled ? 'bg-green-500' : 'bg-amber-500'
        }`} />
        <div className="min-w-0">
          <p className="text-sm text-slate-200">{label}</p>
          <p className="text-xs text-slate-500 font-mono truncate">
            {configured ? `${draft.host}:${draft.port}` : 'Not configured'}
          </p>
          {!draft.enabled && configured && (
            <p className="text-xs text-amber-500/80">Disabled</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
        >
          <Pencil size={12} />
          Edit
        </button>
        {configured && (
          <button
            onClick={onClear}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── ARR Edit Modal ───────────────────────────────────────────────────────────

function ArrModal({
  label, testKey, keySet, draft, onSave, onClose,
}: {
  label: string
  testKey: string
  keySet: boolean
  draft: ArrDraft
  onSave: (d: ArrDraft) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<ArrDraft>({ ...draft })
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')

  const test = async () => {
    setTestState('testing')
    const res = await api.config.testOne(testKey, {
      host: local.host || undefined,
      port: local.port > 0 ? local.port : undefined,
      api_key: local.api_key || undefined,
    }).catch(() => null)
    setTestState(res?.ok ? 'ok' : 'fail')
  }

  return (
    <Modal title={`Edit ${label}`} onClose={onClose}>
      <MField label="Enabled">
        <Toggle checked={local.enabled} onChange={(v) => setLocal({ ...local, enabled: v })} />
      </MField>
      <MField label="Host" tooltip="IP address or hostname (e.g. 192.168.1.100)">
        <input type="text" value={local.host} placeholder="192.168.1.x"
          onChange={(e) => setLocal({ ...local, host: e.target.value })}
          className={INPUT_CLS} />
      </MField>
      <MField label="Port" tooltip="Default: Sonarr 8989 / 8990, Radarr 7878 / 7879">
        <input type="number" value={local.port} min={1} max={65535}
          onChange={(e) => setLocal({ ...local, port: Number(e.target.value) })}
          className={PORT_CLS} />
      </MField>
      <MField label="API Key" tooltip="Found in Settings → General → Security in your ARR instance">
        <input type="password" value={local.api_key}
          placeholder={keySet ? 'Leave blank to keep current' : 'Paste API key'}
          onChange={(e) => setLocal({ ...local, api_key: e.target.value })}
          className={INPUT_CLS} />
        {keySet && !local.api_key && <span className="text-xs text-slate-500 shrink-0">key set</span>}
      </MField>

      <div className="flex justify-end gap-2 pt-4">
        <button type="button" onClick={test} disabled={testState === 'testing'}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50">
          {testState === 'testing' ? 'Testing…' : 'Test'}
          {testState === 'ok'   && <CheckCircle size={14} className="text-green-400" />}
          {testState === 'fail' && <XCircle size={14} className="text-red-400" />}
        </button>
        <button onClick={() => { onSave(local); onClose() }}
          className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium">
          Save
        </button>
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
    const res = await api.config.testOne('rdt', {
      host: local.host || undefined,
      port: local.port > 0 ? local.port : undefined,
      username: local.username || undefined,
      password: local.password || undefined,
    }).catch(() => null)
    setTestState(res?.ok ? 'ok' : 'fail')
  }

  return (
    <Modal title="Edit RDT-client" onClose={onClose}>
      <MField label="Enabled">
        <Toggle checked={local.enabled} onChange={(v) => setLocal({ ...local, enabled: v })} />
      </MField>
      <MField label="Host" tooltip="IP address or hostname of your RDT-client instance">
        <input type="text" value={local.host} placeholder="192.168.1.x"
          onChange={(e) => setLocal({ ...local, host: e.target.value })}
          className={INPUT_CLS} />
      </MField>
      <MField label="Port" tooltip="Default RDT-client port is 6500">
        <input type="number" value={local.port} min={1} max={65535}
          onChange={(e) => setLocal({ ...local, port: Number(e.target.value) })}
          className={PORT_CLS} />
      </MField>
      <MField label="Username" tooltip="Your RDT-client login username">
        <input type="text" value={local.username} placeholder="username"
          onChange={(e) => setLocal({ ...local, username: e.target.value })}
          className={INPUT_CLS} />
      </MField>
      <MField label="Password" tooltip="Your RDT-client login password. Stored encrypted — never as plain text.">
        <input type="password" value={local.password}
          placeholder={passwordSet ? 'Leave blank to keep current' : 'Enter password'}
          onChange={(e) => setLocal({ ...local, password: e.target.value })}
          className={INPUT_CLS} />
        {passwordSet && !local.password && <span className="text-xs text-slate-500 shrink-0">set</span>}
      </MField>

      <div className="flex justify-end gap-2 pt-4">
        <button type="button" onClick={test} disabled={testState === 'testing'}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-50">
          {testState === 'testing' ? 'Testing…' : 'Test'}
          {testState === 'ok'   && <CheckCircle size={14} className="text-green-400" />}
          {testState === 'fail' && <XCircle size={14} className="text-red-400" />}
        </button>
        <button onClick={() => { onSave(local); onClose() }}
          className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium">
          Save
        </button>
      </div>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Connections() {
  const [config, setConfig]   = useState<FullConfig | null>(null)
  const [drafts, setDrafts]   = useState<Drafts | null>(null)
  const [editing, setEditing] = useState<EditTarget>(null)
  const [loadError, setLoadError] = useState(false)

  const load = () => {
    setLoadError(false)
    api.config.get().then((c) => {
      setConfig(c)
      setDrafts(buildDrafts(c.connections))
    }).catch(() => setLoadError(true))
  }

  useEffect(load, [])

  const save = async (updated: Drafts, prev: Drafts) => {
    const result = await api.config.update({ connections: buildUpdate(updated) }).catch(() => null)
    if (result) {
      setConfig(result)
      setDrafts(buildDrafts(result.connections))
    } else {
      setDrafts(prev)
    }
  }

  const handleArrSave = (key: ArrKey, draft: ArrDraft) => {
    if (!drafts) return
    const prev = drafts
    const updated = { ...drafts, [key]: draft }
    setDrafts(updated)
    save(updated, prev)
  }

  const handleRdtSave = (draft: RdtDraft) => {
    if (!drafts) return
    const prev = drafts
    const updated = { ...drafts, rdt: draft }
    setDrafts(updated)
    save(updated, prev)
  }

  const handleArrClear = (key: ArrKey) => {
    if (!drafts) return
    const prev = drafts
    const updated = { ...drafts, [key]: { host: '', port: 0, api_key: '', enabled: false } }
    setDrafts(updated)
    save(updated, prev)
  }

  const handleRdtClear = () => {
    if (!drafts) return
    const prev = drafts
    const updated = { ...drafts, rdt: { host: '', port: 0, username: '', password: '', enabled: false } }
    setDrafts(updated)
    save(updated, prev)
  }

  if (loadError) return <ServerError onRetry={load} />
  if (!config || !drafts) return <p className="text-slate-500 text-sm">Loading…</p>

  const conn = config.connections

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Connections"
        description="Configure your ARR apps and download client. API keys and passwords are stored encrypted — never as plain text."
      />

      <SectionCard title="Sonarr">
        <InstanceRow label="Sonarr" draft={drafts.sonarr} configured={Boolean(drafts.sonarr.host)}
          onEdit={() => setEditing('sonarr')} onClear={() => handleArrClear('sonarr')} />
        <InstanceRow label="Sonarr 4K" draft={drafts.sonarr4k} configured={Boolean(drafts.sonarr4k.host)}
          onEdit={() => setEditing('sonarr4k')} onClear={() => handleArrClear('sonarr4k')} />
      </SectionCard>

      <SectionCard title="Radarr">
        <InstanceRow label="Radarr" draft={drafts.radarr} configured={Boolean(drafts.radarr.host)}
          onEdit={() => setEditing('radarr')} onClear={() => handleArrClear('radarr')} />
        <InstanceRow label="Radarr 4K" draft={drafts.radarr4k} configured={Boolean(drafts.radarr4k.host)}
          onEdit={() => setEditing('radarr4k')} onClear={() => handleArrClear('radarr4k')} />
      </SectionCard>

      <SectionCard title="Downloaders">
        <InstanceRow label="RDT-client" draft={drafts.rdt} configured={Boolean(drafts.rdt.host)}
          onEdit={() => setEditing('rdt')} onClear={handleRdtClear} />
      </SectionCard>
      {editing && editing !== 'rdt' && (
        <ArrModal
          label={{ sonarr: 'Sonarr', sonarr4k: 'Sonarr 4K', radarr: 'Radarr', radarr4k: 'Radarr 4K' }[editing]}
          testKey={{ sonarr: 'Sonarr', sonarr4k: 'Sonarr-4K', radarr: 'Radarr', radarr4k: 'Radarr-4K' }[editing]}
          keySet={(conn as never)[`${editing}_api_key_set`] as boolean}
          draft={drafts[editing]}
          onSave={(d) => handleArrSave(editing, d)}
          onClose={() => setEditing(null)}
        />
      )}
      {editing === 'rdt' && (
        <RdtModal
          passwordSet={conn.rdt_password_set}
          draft={drafts.rdt}
          onSave={handleRdtSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
