import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { DbConfig, NotificationProvider } from '../../types'
import { NOTIFICATION_EVENTS } from '../../types'
import { Modal, MField, PageHeader, ServerError, Tip, Toggle, INPUT_CLS } from '../../components/settings/shared'
import { useSaveState } from '../../hooks/useSaveState'
import { Bell, Pencil, Trash2, Send, Plus, Megaphone, MessageSquare, Ghost, Crosshair, Terminal, Smartphone } from 'lucide-react'

// ─── Provider type definitions ────────────────────────────────────────────────

interface ProviderTypeInfo {
  type: string
  name: string
  subtitle: string
  placeholder: string
  icon: React.ReactNode
  urlLabel: string
  urlHelpText: string
  urlHelpHref: string
}

const PROVIDER_TYPES: ProviderTypeInfo[] = [
  {
    type: 'apprise',
    name: 'Apprise',
    subtitle: 'github.com/caronc/apprise',
    placeholder: 'schema://...',
    icon: <Megaphone size={28} />,
    urlLabel: 'Apprise URL',
    urlHelpText: 'Apprise URL formats →',
    urlHelpHref: 'https://github.com/caronc/apprise/wiki',
  },
  {
    type: 'discord',
    name: 'Discord',
    subtitle: 'discord.com',
    placeholder: 'discord://webhook_id/token',
    icon: <MessageSquare size={28} />,
    urlLabel: 'Webhook URL',
    urlHelpText: 'How to create a Discord webhook →',
    urlHelpHref: 'https://support.discord.com/hc/en-us/articles/228383668',
  },
  {
    type: 'gotify',
    name: 'Gotify',
    subtitle: 'gotify.net',
    placeholder: 'gotify://hostname/token',
    icon: <Ghost size={28} />,
    urlLabel: 'Gotify URL',
    urlHelpText: 'Gotify docs →',
    urlHelpHref: 'https://gotify.net/docs',
  },
  {
    type: 'notifiarr',
    name: 'Notifiarr',
    subtitle: 'notifiarr.com',
    placeholder: 'notifiarr://apikey/',
    icon: <Crosshair size={28} />,
    urlLabel: 'Notifiarr URL',
    urlHelpText: 'Notifiarr docs →',
    urlHelpHref: 'https://notifiarr.wiki',
  },
  {
    type: 'ntfy',
    name: 'ntfy',
    subtitle: 'ntfy.sh',
    placeholder: 'ntfy://ntfy.sh/topic',
    icon: <Terminal size={28} />,
    urlLabel: 'ntfy URL',
    urlHelpText: 'ntfy docs →',
    urlHelpHref: 'https://docs.ntfy.sh',
  },
  {
    type: 'pushover',
    name: 'Pushover',
    subtitle: 'pushover.net',
    placeholder: 'pover://user@token',
    icon: <Smartphone size={28} />,
    urlLabel: 'Pushover URL',
    urlHelpText: 'Pushover API docs →',
    urlHelpHref: 'https://pushover.net/api',
  },
  {
    type: 'telegram',
    name: 'Telegram',
    subtitle: 'core.telegram.org/bots',
    placeholder: 'tgram://bottoken/chatid',
    icon: <Send size={28} />,
    urlLabel: 'Telegram URL',
    urlHelpText: 'Telegram Bot API docs →',
    urlHelpHref: 'https://core.telegram.org/bots/api',
  },
]

function getProviderType(type: string): ProviderTypeInfo {
  return PROVIDER_TYPES.find((t) => t.type === type) ?? PROVIDER_TYPES[0]
}

function randomId(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}

function newProvider(type: string): NotificationProvider {
  return {
    id: randomId(),
    type,
    name: '',
    enabled: true,
    url: '',
    events: ['strike', 'slow_strike', 'removed'],
  }
}

// ─── Type picker modal ────────────────────────────────────────────────────────

interface TypePickerModalProps {
  onSelect: (pt: ProviderTypeInfo) => void
  onClose: () => void
}

function TypePickerModal({ onSelect, onClose }: TypePickerModalProps) {
  return (
    <Modal title="Add Notification Provider" onClose={onClose} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-slate-400">Choose a notification provider type to configure:</p>
        <div className="grid grid-cols-3 gap-3">
          {PROVIDER_TYPES.map((pt) => (
            <button
              key={pt.type}
              type="button"
              onClick={() => onSelect(pt)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 transition-all text-center group"
            >
              <div className="text-white/70 group-hover:text-white transition-colors">
                {pt.icon}
              </div>
              <span className="text-sm font-semibold text-slate-200 group-hover:text-white">{pt.name}</span>
              <span className="text-[11px] text-slate-500 group-hover:text-slate-400 leading-tight">{pt.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Provider config modal ────────────────────────────────────────────────────

interface ProviderModalProps {
  provider: NotificationProvider
  onSave: (p: NotificationProvider) => void
  onClose: () => void
}

function ProviderModal({ provider, onSave, onClose }: ProviderModalProps) {
  const [draft, setDraft] = useState<NotificationProvider>({ ...provider })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const pt = getProviderType(draft.type)

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
    <Modal title={isNew ? `Add ${pt.name} Provider` : 'Edit Provider'} onClose={onClose}>
      <div className="space-y-4">
        <MField label="Name" tooltip="A unique name to identify this notification provider.">
          <input
            type="text"
            placeholder={`e.g. ${pt.name} alerts`}
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
          <div className="flex flex-col gap-1 items-end">
            <input
              type="text"
              placeholder={pt.placeholder}
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              className={`${INPUT_CLS} font-mono text-xs`}
            />
            <a
              href="https://github.com/caronc/apprise/wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Apprise URL formats →
            </a>
          </div>
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
          <div className="flex items-center gap-2">
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
                {testResult ? '✓ Sent' : '✕ Failed — check URL'}
              </span>
            )}
          </div>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const [db, setDb]           = useState<DbConfig | null>(null)
  const [providers, setProviders] = useState<NotificationProvider[]>([])
  const [loadError, setLoadError] = useState(false)
  const [showTypePicker, setShowTypePicker] = useState(false)
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

  const handleTypeSelect = (pt: ProviderTypeInfo) => {
    setShowTypePicker(false)
    setEditing(newProvider(pt.type))
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Notifications"
        description="Configure notification providers"
      />

      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--bd)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--bd)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Providers</h2>
          <button
            onClick={() => setShowTypePicker(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
          >
            <Plus size={14} />
            Add Provider
          </button>
        </div>

        {providers.length === 0 ? (
          <div className="py-12 text-center">
            <Bell size={24} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">No notification providers</p>
            <p className="text-xs text-slate-500 mt-1">Add a notification provider to get alerts.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--bd)]">
            {providers.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-start gap-3">
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
      </div>

      {saving && <p className="text-xs text-slate-500">Saving…</p>}
      {saved && <p className="text-xs text-green-400">✓ Saved</p>}

      {showTypePicker && (
        <TypePickerModal
          onSelect={handleTypeSelect}
          onClose={() => setShowTypePicker(false)}
        />
      )}

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
