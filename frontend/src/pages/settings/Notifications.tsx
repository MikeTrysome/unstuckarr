import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { DbConfig, NotificationProvider } from '../../types'
import { NOTIFICATION_EVENTS } from '../../types'
import { Modal, MField, PageHeader, SectionCard, ServerError, Tip, Toggle, INPUT_CLS } from '../../components/settings/shared'
import { useSaveState } from '../../hooks/useSaveState'
import { Bell, Pencil, Trash2, Send, Plus } from 'lucide-react'

function newProvider(): NotificationProvider {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    url: '',
    events: ['strike', 'slow_strike', 'removed'],
  }
}

interface ProviderModalProps {
  provider: NotificationProvider
  onSave: (p: NotificationProvider) => void
  onClose: () => void
}

function ProviderModal({ provider, onSave, onClose }: ProviderModalProps) {
  const [draft, setDraft] = useState<NotificationProvider>({ ...provider })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)

  const toggleEvent = (key: string) => {
    setDraft((d) => ({
      ...d,
      events: d.events.includes(key) ? d.events.filter((e) => e !== key) : [...d.events, key],
    }))
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.config.testNotification(draft.id)
      setTestResult(res.ok)
    } catch {
      setTestResult(false)
    } finally {
      setTesting(false)
    }
  }

  const isNew = !provider.name && !provider.url
  const canSave = draft.name.trim() && draft.url.trim()

  return (
    <Modal title={isNew ? 'Add Provider' : 'Edit Provider'} onClose={onClose}>
      <div className="space-y-4">
        <MField label="Name" tooltip="A unique name to identify this notification provider.">
          <input
            type="text"
            placeholder="e.g. Discord alerts"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className={INPUT_CLS}
            autoFocus
          />
        </MField>

        <MField label="Enabled" tooltip="Enable or disable this provider without deleting it.">
          <Toggle checked={draft.enabled} onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} />
        </MField>

        <MField
          label="Apprise URL"
          tooltip="Apprise notification URL for this provider. Supports 80+ services: Discord, Telegram, Slack, Ntfy, Pushover, Gotify and more."
        >
          <input
            type="text"
            placeholder="discord://webhook_id/token"
            value={draft.url}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            className={`${INPUT_CLS} font-mono text-xs`}
          />
          <a
            href="https://github.com/caronc/apprise/wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block"
          >
            Apprise URL formats →
          </a>
        </MField>

        <div>
          <p className="text-xs text-slate-400 mb-2 font-medium">
            Trigger on
            <Tip text="Select which events cause this provider to send a notification." />
          </p>
          <div className="space-y-2">
            {NOTIFICATION_EVENTS.map(({ key, label, description }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={draft.events.includes(key)}
                  onChange={() => toggleEvent(key)}
                  className="mt-0.5 accent-indigo-500"
                />
                <div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{label}</span>
                  <p className="text-xs text-slate-500">{description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--bd)]">
          <button
            type="button"
            onClick={test}
            disabled={testing || !draft.url.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors disabled:opacity-40"
          >
            <Send size={13} />
            {testing ? 'Sending…' : 'Test'}
          </button>
          {testResult !== null && (
            <span className={`text-xs ${testResult ? 'text-green-400' : 'text-red-400'}`}>
              {testResult ? 'Notification sent successfully' : 'Notification failed — check URL'}
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => canSave && onSave(draft)}
              disabled={!canSave}
              className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40"
            >
              {isNew ? 'Add' : 'Update'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function Notifications() {
  const [db, setDb]           = useState<DbConfig | null>(null)
  const [providers, setProviders] = useState<NotificationProvider[]>([])
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState<NotificationProvider | null>(null)
  const { saving, saved, wrap } = useSaveState()

  const load = () => {
    setLoadError(false)
    api.config.get().then((c) => {
      setDb(c.db)
      setProviders(c.db.notifications_providers ?? [])
    }).catch(() => setLoadError(true))
  }

  useEffect(load, [])

  if (loadError) return <ServerError onRetry={load} />
  if (!db) return <p className="text-slate-500 text-sm">Loading…</p>

  const save = (updated: NotificationProvider[]) => wrap(async () => {
    const result = await api.config.update({
      db: { notifications_providers: updated },
    }).catch(() => null)
    if (result) {
      setDb(result.db)
      setProviders(result.db.notifications_providers ?? [])
    }
  })

  const upsertProvider = (p: NotificationProvider) => {
    const updated = providers.some((x) => x.id === p.id)
      ? providers.map((x) => (x.id === p.id ? p : x))
      : [...providers, p]
    setProviders(updated)
    setEditing(null)
    save(updated)
  }

  const deleteProvider = (id: string) => {
    const updated = providers.filter((p) => p.id !== id)
    setProviders(updated)
    save(updated)
  }

  const toggleEnabled = (id: string) => {
    const updated = providers.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p)
    setProviders(updated)
    save(updated)
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Notifications"
        description="Get notified on strikes, removals, and retries. Each provider can be configured for specific events."
      />

      <SectionCard title="Notification Providers">
        {providers.length === 0 ? (
          <div className="py-8 text-center">
            <Bell size={24} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No notification providers configured.</p>
            <p className="text-xs text-slate-600 mt-1">Add a provider to start receiving notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--bd)]">
            {providers.map((p) => (
              <div key={p.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${p.enabled ? 'text-slate-200' : 'text-slate-500'}`}>
                      {p.name}
                    </span>
                    {!p.enabled && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-slate-500 border border-white/10">
                        disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-mono truncate mt-0.5">{p.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {NOTIFICATION_EVENTS.filter((e) => p.events.includes(e.key)).map((e) => (
                      <span key={e.key}
                        className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        {e.label}
                      </span>
                    ))}
                    {p.events.length === 0 && (
                      <span className="text-xs text-slate-600">No events selected</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Toggle checked={p.enabled} onChange={() => toggleEnabled(p.id)} />
                  <button
                    onClick={() => setEditing(p)}
                    className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteProvider(p.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-[var(--bd)]">
          <button
            onClick={() => setEditing(newProvider())}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
          >
            <Plus size={14} />
            Add Provider
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Available events">
        <div className="py-1 space-y-3">
          {NOTIFICATION_EVENTS.map(({ key, label, description }) => (
            <div key={key} className="flex items-start gap-3">
              <span className="mt-0.5 text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex-shrink-0">
                {label}
              </span>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {saving && <p className="text-xs text-slate-500">Saving…</p>}
      {saved && <p className="text-xs text-green-400">✓ Saved</p>}

      {editing && (
        <ProviderModal
          provider={editing}
          onSave={upsertProvider}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
